import type { NextApiRequest, NextApiResponse } from 'next';
import { generateImage, buildCinematicPrompt, sanitizePromptForImageGeneration } from '@/utils/openai';
import { persistImage, isPersistedUrl } from '@/utils/image-storage';
import { GenerateImageResponse, ApiError } from '@/types';
import { requireAuth, checkRateLimit } from '@/utils/api-auth';
import { deductCredits, getUserCredits, CreditError } from '@/utils/db';

// Valid parameter values for OpenAI API
const VALID_MODELS = ['dall-e-3', 'gpt-image-1.5'];
const DALLE3_SIZES = ['1024x1024', '1024x1792', '1792x1024'];
const GPT_IMAGE_SIZES = ['1024x1024', '1536x1024', '1024x1536', 'auto'];
const VALID_QUALITIES = ['standard', 'hd'];
const VALID_STYLES = ['vivid', 'natural'];
const VALID_OUTPUT_FORMATS = ['png', 'jpeg', 'webp'];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateImageResponse | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  // Rate limiting: 10 image generations per minute per user
  if (!checkRateLimit(`image:${userId}`, 10, 60000)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait before generating more images.' });
  }

  // Server-side credits validation and deduction
  const userCredits = await getUserCredits(userId);
  if (!userCredits) {
    return res.status(403).json({ error: 'User not found or credits not available' });
  }

  if (userCredits.creditsRemaining < 1) {
    return res.status(402).json({
      error: 'Insufficient credits. Please purchase more credits to continue generating images.',
      creditsRemaining: 0,
    });
  }

  const { prompt, shotType, style, lighting, mood, size, quality, imageStyle, projectId, sceneId, model, outputFormat } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // projectId is required for image persistence
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Project ID is required for image generation' });
  }

  // sceneId is optional but must be a non-empty string if provided
  if (sceneId !== undefined && sceneId !== null) {
    if (typeof sceneId !== 'string' || !sceneId.trim()) {
      return res.status(400).json({ error: 'Scene ID, if provided, must be a non-empty string' });
    }
  }

  // Validate model parameter (default to gpt-image-1.5 for speed and cost)
  const selectedModel = model || 'gpt-image-1.5';
  if (!VALID_MODELS.includes(selectedModel)) {
    return res.status(400).json({ error: `Invalid model. Must be one of: ${VALID_MODELS.join(', ')}` });
  }

  // Validate size based on selected model
  const validSizes = selectedModel === 'dall-e-3' ? DALLE3_SIZES : GPT_IMAGE_SIZES;
  if (size && !validSizes.includes(size)) {
    return res.status(400).json({ error: `Invalid size for ${selectedModel}. Must be one of: ${validSizes.join(', ')}` });
  }

  if (quality && !VALID_QUALITIES.includes(quality)) {
    return res.status(400).json({ error: `Invalid quality. Must be one of: ${VALID_QUALITIES.join(', ')}` });
  }

  if (imageStyle && !VALID_STYLES.includes(imageStyle)) {
    return res.status(400).json({ error: `Invalid style. Must be one of: ${VALID_STYLES.join(', ')}` });
  }

  // Validate outputFormat (GPT Image 1.5 only)
  if (outputFormat) {
    if (selectedModel !== 'gpt-image-1.5') {
      return res.status(400).json({ error: 'Output format is only supported for gpt-image-1.5 model' });
    }
    if (!VALID_OUTPUT_FORMATS.includes(outputFormat)) {
      return res.status(400).json({ error: `Invalid output format. Must be one of: ${VALID_OUTPUT_FORMATS.join(', ')}` });
    }
  }

  // Sanitize prompt to comply with DALL-E safety guidelines
  // This rewrites potentially problematic content while preserving artistic intent
  const sanitizedPrompt = await sanitizePromptForImageGeneration(prompt);

  // Build enhanced cinematic prompt
  const enhancedPrompt = buildCinematicPrompt(sanitizedPrompt, {
    shotType,
    style,
    lighting,
    mood,
  });

  const result = await generateImage({
    prompt: enhancedPrompt,
    model: selectedModel,
    size: size || '1024x1024',
    quality: quality || 'standard',
    style: imageStyle || 'vivid',
    outputFormat: outputFormat || undefined,
  });

  if (!result.success || !result.imageUrl) {
    return res.status(500).json({
      success: false,
      error: result.error || 'Failed to generate image',
    });
  }

  // Deduct 1 credit for successful image generation (atomic operation)
  let deductResult;
  try {
    deductResult = await deductCredits(
      userId,
      1,
      `Image generation for scene ${sceneId || 'unknown'}`,
      sceneId,
      'generation'
    );
  } catch (error) {
    // Log detailed context for debugging
    console.error('[generate-image] Failed to deduct credits after successful generation', {
      userId,
      sceneId,
      projectId,
      previousBalance: userCredits.creditsRemaining,
      error: error instanceof CreditError ? { code: error.code, message: error.message } : error,
    });
    // Credit integrity: fail the request if we cannot properly deduct credits
    // The image generation API call was made, but we must not return content without proper billing
    if (error instanceof CreditError) {
      if (error.code === 'INSUFFICIENT_CREDITS') {
        return res.status(402).json({
          error: 'Insufficient credits. Your credits may have been used elsewhere.',
          creditsRemaining: 0,
        });
      }
      if (error.code === 'DB_UNAVAILABLE') {
        return res.status(503).json({
          success: false,
          error: 'Credit service temporarily unavailable. Please try again later.',
        });
      }
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to process credits. Please try again.',
    });
  }

  // Persist the image to Supabase Storage for permanent access
  // OpenAI DALL-E URLs expire after ~1 hour, so we need to store them
  try {
    const persistedUrl = await persistImage(result.imageUrl, projectId, sceneId);

    // Check if the image was actually persisted or if we got back the temporary URL
    if (isPersistedUrl(persistedUrl)) {
      return res.status(200).json({
        success: true,
        imageUrl: persistedUrl,
        urlType: 'permanent',
        creditsRemaining: deductResult?.creditsRemaining ?? userCredits.creditsRemaining - 1,
      });
    } else {
      // persistImage returned the original URL (storage not configured or failed silently)
      return res.status(200).json({
        success: true,
        imageUrl: persistedUrl,
        urlType: 'temporary',
        warning: 'Image storage not configured. The image URL is temporary and will expire in about 1 hour.',
        creditsRemaining: deductResult?.creditsRemaining ?? userCredits.creditsRemaining - 1,
      });
    }
  } catch (error) {
    console.error('[generate-image] Failed to persist image:', error);
    // Fall back to temporary URL if persistence fails
    return res.status(200).json({
      ...result,
      urlType: 'temporary',
      warning: 'Image persistence failed. The image URL is temporary and will expire in about 1 hour.',
      creditsRemaining: deductResult?.creditsRemaining ?? userCredits.creditsRemaining - 1,
    });
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { generateImage, buildCinematicPrompt, sanitizePromptForImageGeneration } from '@/utils/openai';
import { persistImage, isPersistedUrl } from '@/utils/image-storage';
import { GenerateImageResponse, ApiError } from '@/types';
import { requireAuth, checkRateLimit } from '@/utils/api-auth';

// Valid parameter values for OpenAI API
const VALID_SIZES = ['1024x1024', '1024x1792', '1792x1024'];
const VALID_QUALITIES = ['standard', 'hd'];
const VALID_STYLES = ['vivid', 'natural'];

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

  // NOTE: Credits are currently tracked client-side in localStorage for UX purposes.
  // For production-grade credits enforcement, implement:
  // 1. Database-backed credits storage (e.g., user.creditsRemaining in Prisma schema)
  // 2. Atomic credit deduction before generation (with transaction/optimistic locking)
  // 3. Credit rollback on generation failure
  // The current client-side credits serve as a UX hint, not a security measure.

  const { prompt, shotType, style, lighting, mood, size, quality, imageStyle, projectId, sceneId } = req.body;

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

  // Validate OpenAI-specific parameters
  if (size && !VALID_SIZES.includes(size)) {
    return res.status(400).json({ error: `Invalid size. Must be one of: ${VALID_SIZES.join(', ')}` });
  }

  if (quality && !VALID_QUALITIES.includes(quality)) {
    return res.status(400).json({ error: `Invalid quality. Must be one of: ${VALID_QUALITIES.join(', ')}` });
  }

  if (imageStyle && !VALID_STYLES.includes(imageStyle)) {
    return res.status(400).json({ error: `Invalid style. Must be one of: ${VALID_STYLES.join(', ')}` });
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
    size: size || '1024x1024',
    quality: quality || 'standard',
    style: imageStyle || 'vivid',
  });

  if (!result.success || !result.imageUrl) {
    return res.status(500).json({
      success: false,
      error: result.error || 'Failed to generate image',
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
      });
    } else {
      // persistImage returned the original URL (storage not configured or failed silently)
      return res.status(200).json({
        success: true,
        imageUrl: persistedUrl,
        urlType: 'temporary',
        warning: 'Image storage not configured. The image URL is temporary and will expire in about 1 hour.',
      });
    }
  } catch (error) {
    console.error('[generate-image] Failed to persist image:', error);
    // Fall back to temporary URL if persistence fails
    return res.status(200).json({
      ...result,
      urlType: 'temporary',
      warning: 'Image persistence failed. The image URL is temporary and will expire in about 1 hour.',
    });
  }
}

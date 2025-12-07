import type { NextApiRequest, NextApiResponse } from 'next';
import { generateImage, buildCinematicPrompt } from '@/utils/openai';
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

  const { prompt, shotType, style, lighting, mood, size, quality, imageStyle } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
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

  // Build enhanced cinematic prompt
  const enhancedPrompt = buildCinematicPrompt(prompt, {
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

  if (!result.success) {
    return res.status(500).json({
      success: false,
      error: result.error || 'Failed to generate image',
    });
  }

  return res.status(200).json(result);
}

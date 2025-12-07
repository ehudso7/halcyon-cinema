import type { NextApiRequest, NextApiResponse } from 'next';
import { generateImage, buildCinematicPrompt } from '@/utils/openai';
import { GenerateImageResponse, ApiError } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateImageResponse | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { prompt, shotType, style, lighting, mood, size, quality, imageStyle } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
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

import type { NextApiRequest, NextApiResponse } from 'next';
import { generateImage, buildCinematicPrompt, sanitizePromptForImageGeneration } from '@/utils/openai';
import { checkRateLimit } from '@/utils/api-auth';

interface DemoGenerateResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

// Valid genres for demo generation
const VALID_GENRES = ['fantasy', 'scifi', 'noir', 'romance', 'horror', 'action'];

// Get client IP from various headers (handles proxies/load balancers)
// Returns null if IP cannot be determined to prevent rate limit bypass
function getClientIP(req: NextApiRequest): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0];
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp) {
    return realIp;
  }
  if (req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }
  // Return null instead of 'unknown' to prevent shared rate limit bucket
  return null;
}

/**
 * Demo Image Generation API
 *
 * This endpoint allows unauthenticated users to generate a single preview image
 * during the onboarding flow. Strict rate limiting prevents abuse.
 *
 * Rate limits:
 * - 3 images per IP per hour
 * - Only standard quality (1024x1024)
 * - Images are temporary (not persisted)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DemoGenerateResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });
  }

  // Get client IP for rate limiting
  const clientIP = getClientIP(req);

  // Reject requests where IP cannot be determined to prevent rate limit bypass
  if (!clientIP) {
    return res.status(400).json({
      success: false,
      error: 'Unable to process request. Please try again or contact support.'
    });
  }

  // Strict rate limiting: 3 images per IP per hour
  if (!checkRateLimit(`demo-image:${clientIP}`, 3, 3600000)) {
    return res.status(429).json({
      success: false,
      error: 'Demo limit reached. Sign up for unlimited access!'
    });
  }

  const { prompt, genre } = req.body;

  // Validate genre if provided
  if (genre && !VALID_GENRES.includes(genre)) {
    return res.status(400).json({
      success: false,
      error: `Invalid genre. Must be one of: ${VALID_GENRES.join(', ')}`
    });
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }

  // Limit prompt length for demo
  if (prompt.length > 500) {
    return res.status(400).json({ success: false, error: 'Prompt is too long (max 500 characters)' });
  }

  try {
    // Sanitize prompt for safety
    const sanitizedPrompt = await sanitizePromptForImageGeneration(prompt);

    // Map genre to cinematic style
    const genreStyles: Record<string, { style: string; mood: string; lighting: string }> = {
      fantasy: { style: 'epic fantasy', mood: 'magical and mysterious', lighting: 'ethereal golden hour' },
      scifi: { style: 'sci-fi cinematic', mood: 'futuristic and awe-inspiring', lighting: 'neon and atmospheric' },
      noir: { style: 'film noir', mood: 'mysterious and dramatic', lighting: 'high contrast shadows' },
      romance: { style: 'romantic drama', mood: 'warm and intimate', lighting: 'soft golden hour' },
      horror: { style: 'atmospheric horror', mood: 'eerie and suspenseful', lighting: 'dim and foreboding' },
      action: { style: 'action blockbuster', mood: 'intense and dynamic', lighting: 'dramatic and bold' },
    };

    const genreStyle = genre && genreStyles[genre] ? genreStyles[genre] : {
      style: 'cinematic',
      mood: 'atmospheric',
      lighting: 'dramatic',
    };

    // Build enhanced cinematic prompt
    const enhancedPrompt = buildCinematicPrompt(sanitizedPrompt, {
      shotType: 'wide establishing',
      style: genreStyle.style,
      lighting: genreStyle.lighting,
      mood: genreStyle.mood,
    });

    // Generate the image (standard quality only for demo)
    // Note: gpt-image-1.5 doesn't support style parameter (DALL-E 3 only)
    const result = await generateImage({
      prompt: enhancedPrompt,
      model: 'gpt-image-1.5', // Fast and cost-effective
      size: '1024x1024',
      quality: 'standard',
    });

    if (!result.success || !result.imageUrl) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate image',
      });
    }

    // Return the temporary image URL
    // Note: This URL will expire in about 1 hour, which is fine for demo purposes
    return res.status(200).json({
      success: true,
      imageUrl: result.imageUrl,
    });
  } catch (error) {
    console.error('[demo/generate-image] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate image. Please try again.',
    });
  }
}

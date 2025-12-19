/**
 * Video Generation API Endpoint
 *
 * Generates AI-powered videos using the Replicate API with support for:
 * - Text-to-video generation (Zeroscope model)
 * - Image-to-video generation (Stable Video Diffusion model)
 * - Multiple quality tiers (standard, professional, premium)
 * - Credit-based usage tracking
 * - Rate limiting (2 requests per minute per user)
 *
 * @endpoint POST /api/generate-video
 * @auth Required - Requires authenticated session with CSRF protection
 * @ratelimit 2 requests per minute per user
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuthWithCSRF, checkRateLimit } from '@/utils/api-auth';
import { deductCredits, getUserCredits, CreditError } from '@/utils/db';
import { persistVideo } from '@/utils/media-storage';
import { ApiError } from '@/types';

/** Replicate API token for video generation */
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

/** Video quality tier options */
type VideoQualityTier = 'standard' | 'professional' | 'premium';

/** Credit costs and resolution for each video quality tier */
const VIDEO_QUALITY_CREDITS: Record<VideoQualityTier, { credits: number; resolution: string }> = {
  standard: { credits: 10, resolution: '720p' },
  professional: { credits: 15, resolution: '1080p' },
  premium: { credits: 25, resolution: '4K' },
};

/** Valid video quality tier values for validation */
const VALID_VIDEO_QUALITY_TIERS: VideoQualityTier[] = ['standard', 'professional', 'premium'];

/** Timeout for Replicate API calls (10 seconds for initial request) */
const REPLICATE_REQUEST_TIMEOUT_MS = 10000;

/**
 * Response structure for video generation API
 */
interface GenerateVideoResponse {
  /** Whether the generation was successful */
  success: boolean;
  /** URL of the generated video (if completed) */
  videoUrl?: string;
  /** Error message (if failed) */
  error?: string;
  /** User's remaining credits after generation */
  creditsRemaining?: number;
  /** Current status of the generation */
  status?: 'processing' | 'completed' | 'failed';
  /** Replicate prediction ID for polling status */
  predictionId?: string;
}

/**
 * Replicate API prediction response structure
 */
interface ReplicatePrediction {
  /** Unique prediction identifier */
  id: string;
  /** Current prediction status */
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  /** Output URL(s) when succeeded */
  output?: string | string[];
  /** Error message when failed */
  error?: string;
}

/**
 * Handles video generation requests
 *
 * @param req - Next.js API request containing prompt, imageUrl, duration, aspectRatio, etc.
 * @param res - Next.js API response
 * @returns Generated video URL or error response
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateVideoResponse | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  if (!REPLICATE_API_TOKEN) {
    return res.status(503).json({
      error: 'Video generation is not configured. Please set REPLICATE_API_TOKEN.',
    });
  }

  // Require authentication with CSRF protection
  const userId = await requireAuthWithCSRF(req, res);
  if (!userId) return;

  // Rate limiting: 2 video generations per minute per user
  if (!checkRateLimit(`video:${userId}`, 2, 60000)) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait before generating more videos.',
    });
  }

  // Server-side credits validation
  const userCredits = await getUserCredits(userId);
  if (!userCredits) {
    return res.status(403).json({ error: 'User not found or credits not available' });
  }

  // Parse quality tier for credit calculation
  const requestedQualityTier = req.body.qualityTier;
  const effectiveQualityTier: VideoQualityTier = requestedQualityTier && VALID_VIDEO_QUALITY_TIERS.includes(requestedQualityTier)
    ? requestedQualityTier
    : 'standard';
  const { credits: requiredCredits, resolution } = VIDEO_QUALITY_CREDITS[effectiveQualityTier];

  if (userCredits.creditsRemaining < requiredCredits) {
    // Smart upsell suggestions
    return res.status(402).json({
      error: `Insufficient credits. ${effectiveQualityTier} video (${resolution}) requires ${requiredCredits} credits.`,
      creditsRemaining: userCredits.creditsRemaining,
      creditsRequired: requiredCredits,
      suggestions: {
        buyCredits: {
          description: 'Buy 250 credits for $20',
          creditsProvided: 250,
          price: '$20',
        },
        upgradeSubscription: {
          description: 'Upgrade to Studio tier for 2000 credits/month',
          monthlyCredits: 2000,
          price: '$79/month',
        },
        useLowerTier: userCredits.creditsRemaining >= 10 ? {
          description: 'Use standard quality instead (10 credits, 720p)',
          qualityTier: 'standard',
          creditCost: 10,
        } : undefined,
      },
    });
  }

  const { prompt, imageUrl, duration, aspectRatio, projectId: rawProjectId, sceneId: rawSceneId, qualityTier } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Validate optional projectId and sceneId: must be non-empty strings if provided
  if (rawProjectId !== undefined) {
    if (typeof rawProjectId !== 'string' || !rawProjectId.trim()) {
      return res.status(400).json({ error: 'projectId must be a non-empty string' });
    }
  }
  if (rawSceneId !== undefined) {
    if (typeof rawSceneId !== 'string' || !rawSceneId.trim()) {
      return res.status(400).json({ error: 'sceneId must be a non-empty string' });
    }
  }

  // Use trimmed values for file path construction
  const projectId = rawProjectId?.trim();
  const sceneId = rawSceneId?.trim();

  try {
    // Use Stable Video Diffusion model on Replicate
    // This model generates video from an image, so we need an image first
    // If no imageUrl provided, we'll use a text-to-video model
    const modelVersion = imageUrl
      ? 'stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438' // img2vid
      : 'anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351'; // txt2vid

    const input = imageUrl
      ? {
          input_image: imageUrl,
          motion_bucket_id: 127,
          cond_aug: 0.02,
          decoding_t: 14,
          fps: 6,
        }
      : {
          prompt: prompt.trim(),
          negative_prompt: 'blurry, low quality, distorted, watermark',
          num_frames: duration === 'long' ? 48 : 24,
          width: aspectRatio === '16:9' ? 1024 : aspectRatio === '9:16' ? 576 : 768,
          height: aspectRatio === '16:9' ? 576 : aspectRatio === '9:16' ? 1024 : 768,
          fps: 8,
        };

    // Start the prediction with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REPLICATE_REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          Authorization: `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: modelVersion.split(':')[1],
          input,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-video] Replicate API error:', response.status, errorText);

      // Parse and provide more helpful error messages
      let userMessage = 'Failed to start video generation';
      try {
        const errorData = JSON.parse(errorText);
        if (response.status === 401 || response.status === 403) {
          userMessage = 'Video generation service authentication failed. Please check API configuration.';
        } else if (response.status === 404) {
          userMessage = 'Video generation model not found. The model may have been updated or deprecated.';
        } else if (response.status === 422) {
          userMessage = errorData.detail || 'Invalid video generation parameters';
        } else if (response.status === 429) {
          userMessage = 'Video generation rate limit exceeded. Please try again later.';
        } else if (errorData.detail) {
          userMessage = `Video generation failed: ${errorData.detail}`;
        }
      } catch {
        // If we can't parse the error, use the default message
      }

      return res.status(response.status >= 400 && response.status < 500 ? response.status : 500).json({
        success: false,
        error: userMessage,
      });
    }

    const prediction: ReplicatePrediction = await response.json();

    // Poll for completion (with timeout)
    const maxWaitTime = 120000; // 2 minutes
    const pollInterval = 3000; // 3 seconds
    const startTime = Date.now();

    let finalPrediction = prediction;

    while (
      finalPrediction.status !== 'succeeded' &&
      finalPrediction.status !== 'failed' &&
      finalPrediction.status !== 'canceled' &&
      Date.now() - startTime < maxWaitTime
    ) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const pollController = new AbortController();
      const pollTimeoutId = setTimeout(() => pollController.abort(), REPLICATE_REQUEST_TIMEOUT_MS);
      try {
        const pollResponse = await fetch(
          `https://api.replicate.com/v1/predictions/${prediction.id}`,
          {
            headers: {
              Authorization: `Token ${REPLICATE_API_TOKEN}`,
            },
            signal: pollController.signal,
          }
        );

        if (pollResponse.ok) {
          finalPrediction = await pollResponse.json();
        }
      } catch {
        // Ignore timeout errors during polling, will retry or timeout on max wait
      } finally {
        clearTimeout(pollTimeoutId);
      }
    }

    if (finalPrediction.status === 'succeeded' && finalPrediction.output) {
      // Deduct credits for successful generation based on quality tier
      let deductResult;
      try {
        deductResult = await deductCredits(
          userId,
          requiredCredits,
          `Video generation (${effectiveQualityTier} - ${resolution})`,
          prediction.id,
          'generation'
        );
      } catch (error) {
        console.error('[generate-video] Failed to deduct credits', {
          userId,
          predictionId: prediction.id,
          error: error instanceof CreditError ? { code: error.code, message: error.message } : error,
        });
        // Credit integrity: fail the request if we cannot properly deduct credits
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

      const temporaryVideoUrl = Array.isArray(finalPrediction.output)
        ? finalPrediction.output[0]
        : finalPrediction.output;

      // Persist video to permanent storage if projectId is provided
      let videoUrl = temporaryVideoUrl;
      if (projectId && temporaryVideoUrl) {
        try {
          videoUrl = await persistVideo(temporaryVideoUrl, projectId, sceneId);
        } catch (persistError) {
          console.warn('[generate-video] Failed to persist video, using temporary URL:', persistError);
        }
      }

      return res.status(200).json({
        success: true,
        videoUrl,
        status: 'completed',
        predictionId: prediction.id,
        creditsRemaining: deductResult.creditsRemaining,
      });
    } else if (finalPrediction.status === 'failed') {
      return res.status(500).json({
        success: false,
        error: finalPrediction.error || 'Video generation failed',
        status: 'failed',
        predictionId: prediction.id,
      });
    } else {
      // Still processing - return the prediction ID for polling
      return res.status(202).json({
        success: true,
        status: 'processing',
        predictionId: prediction.id,
        creditsRemaining: userCredits.creditsRemaining,
      });
    }
  } catch (error) {
    console.error('[generate-video] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate video',
    });
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, checkRateLimit } from '@/utils/api-auth';
import { deductCredits, getUserCredits, CreditError } from '@/utils/db';
import { ApiError } from '@/types';

// Replicate API for music generation
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Credit cost for music generation
const MUSIC_CREDIT_COST = 5;

interface GenerateMusicResponse {
  success: boolean;
  audioUrl?: string;
  error?: string;
  creditsRemaining?: number;
  status?: 'processing' | 'completed' | 'failed';
  predictionId?: string;
  duration?: number;
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateMusicResponse | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  if (!REPLICATE_API_TOKEN) {
    return res.status(503).json({
      error: 'Music generation is not configured. Please set REPLICATE_API_TOKEN.',
    });
  }

  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  // Rate limiting: 5 music generations per minute per user
  if (!checkRateLimit(`music:${userId}`, 5, 60000)) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait before generating more music.',
    });
  }

  // Server-side credits validation
  const userCredits = await getUserCredits(userId);
  if (!userCredits) {
    return res.status(403).json({ error: 'User not found or credits not available' });
  }

  if (userCredits.creditsRemaining < MUSIC_CREDIT_COST) {
    return res.status(402).json({
      error: `Insufficient credits. Music generation requires ${MUSIC_CREDIT_COST} credits.`,
      creditsRemaining: userCredits.creditsRemaining,
    });
  }

  const { prompt, duration = 10, genre, mood, tempo } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Validate duration (5-30 seconds)
  const durationSeconds = Math.min(30, Math.max(5, Number(duration) || 10));

  try {
    // Build enhanced prompt with genre/mood/tempo
    let enhancedPrompt = prompt.trim();
    if (genre) enhancedPrompt += `, ${genre} genre`;
    if (mood) enhancedPrompt += `, ${mood} mood`;
    if (tempo) enhancedPrompt += `, ${tempo} tempo`;

    // Use MusicGen model on Replicate
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // MusicGen stereo large model
        version: 'b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38',
        input: {
          prompt: enhancedPrompt,
          duration: durationSeconds,
          model_version: 'stereo-large',
          output_format: 'mp3',
          normalization_strategy: 'loudness',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-music] Replicate API error:', errorText);
      return res.status(500).json({
        success: false,
        error: 'Failed to start music generation',
      });
    }

    const prediction: ReplicatePrediction = await response.json();

    // Poll for completion (with timeout)
    const maxWaitTime = 90000; // 90 seconds
    const pollInterval = 2000; // 2 seconds
    const startTime = Date.now();

    let finalPrediction = prediction;

    while (
      finalPrediction.status !== 'succeeded' &&
      finalPrediction.status !== 'failed' &&
      finalPrediction.status !== 'canceled' &&
      Date.now() - startTime < maxWaitTime
    ) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: {
            Authorization: `Token ${REPLICATE_API_TOKEN}`,
          },
        }
      );

      if (pollResponse.ok) {
        finalPrediction = await pollResponse.json();
      }
    }

    if (finalPrediction.status === 'succeeded' && finalPrediction.output) {
      // Deduct credits for successful generation
      let deductResult;
      try {
        deductResult = await deductCredits(
          userId,
          MUSIC_CREDIT_COST,
          `Music generation: ${enhancedPrompt.substring(0, 50)}`,
          prediction.id,
          'generation'
        );
      } catch (error) {
        console.error('[generate-music] Failed to deduct credits', {
          userId,
          error: error instanceof CreditError ? { code: error.code, message: error.message } : error,
        });
      }

      const audioUrl = Array.isArray(finalPrediction.output)
        ? finalPrediction.output[0]
        : finalPrediction.output;

      return res.status(200).json({
        success: true,
        audioUrl,
        status: 'completed',
        predictionId: prediction.id,
        duration: durationSeconds,
        creditsRemaining: deductResult?.creditsRemaining ?? userCredits.creditsRemaining - MUSIC_CREDIT_COST,
      });
    } else if (finalPrediction.status === 'failed') {
      return res.status(500).json({
        success: false,
        error: finalPrediction.error || 'Music generation failed',
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
    console.error('[generate-music] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate music',
    });
  }
}

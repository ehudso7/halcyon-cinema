import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, checkRateLimit } from '@/utils/api-auth';
import { deductCredits, getUserCredits, CreditError } from '@/utils/db';
import { persistAudio } from '@/utils/media-storage';
import { ApiError } from '@/types';

// Replicate API for music generation
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Credit cost for music generation
const MUSIC_CREDIT_COST = 5;

// Timeout for Replicate API calls (10 seconds for initial request)
const REPLICATE_REQUEST_TIMEOUT_MS = 10000;

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

// Valid genres, moods, and tempos for music generation
const VALID_GENRES = [
  'ambient', 'cinematic', 'classical', 'electronic', 'folk', 'hip-hop',
  'jazz', 'lo-fi', 'orchestral', 'pop', 'rock', 'synthwave', 'world',
] as const;

const VALID_MOODS = [
  'calm', 'dark', 'dramatic', 'energetic', 'happy', 'hopeful',
  'intense', 'melancholic', 'mysterious', 'peaceful', 'romantic', 'tense', 'uplifting',
] as const;

const VALID_TEMPOS = ['slow', 'moderate', 'fast', 'very fast'] as const;

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

  const { prompt, duration = 10, genre, mood, tempo, projectId, sceneId } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Validate optional parameters
  if (genre && !VALID_GENRES.includes(genre)) {
    return res.status(400).json({
      error: `Invalid genre. Must be one of: ${VALID_GENRES.join(', ')}`,
    });
  }

  if (mood && !VALID_MOODS.includes(mood)) {
    return res.status(400).json({
      error: `Invalid mood. Must be one of: ${VALID_MOODS.join(', ')}`,
    });
  }

  if (tempo && !VALID_TEMPOS.includes(tempo)) {
    return res.status(400).json({
      error: `Invalid tempo. Must be one of: ${VALID_TEMPOS.join(', ')}`,
    });
  }

  // Validate duration (5-30 seconds)
  const durationSeconds = Math.min(30, Math.max(5, Number(duration) || 10));

  try {
    // Build enhanced prompt with genre/mood/tempo
    let enhancedPrompt = prompt.trim();
    if (genre) enhancedPrompt += `, ${genre} genre`;
    if (mood) enhancedPrompt += `, ${mood} mood`;
    if (tempo) enhancedPrompt += `, ${tempo} tempo`;

    // Use MusicGen model on Replicate with timeout
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
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

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

      const temporaryAudioUrl = Array.isArray(finalPrediction.output)
        ? finalPrediction.output[0]
        : finalPrediction.output;

      // Persist audio to permanent storage if projectId is provided
      let audioUrl = temporaryAudioUrl;
      if (projectId && temporaryAudioUrl) {
        try {
          audioUrl = await persistAudio(temporaryAudioUrl, projectId, sceneId);
        } catch (persistError) {
          console.warn('[generate-music] Failed to persist audio, using temporary URL:', persistError);
        }
      }

      return res.status(200).json({
        success: true,
        audioUrl,
        status: 'completed',
        predictionId: prediction.id,
        duration: durationSeconds,
        creditsRemaining: deductResult.creditsRemaining,
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

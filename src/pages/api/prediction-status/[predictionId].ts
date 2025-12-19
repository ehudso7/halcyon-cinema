import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { sanitizeGenerationError } from '@/utils/error-sanitizer';
import { ApiError } from '@/types';

// Replicate API for checking prediction status
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Timeout for Replicate API calls
const REPLICATE_REQUEST_TIMEOUT_MS = 10000;

interface PredictionStatusResponse {
  success: boolean;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string;
  error?: string;
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PredictionStatusResponse | ApiError>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  if (!REPLICATE_API_TOKEN) {
    return res.status(503).json({
      error: 'Prediction status check is not configured. Please set REPLICATE_API_TOKEN.',
    });
  }

  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { predictionId, type } = req.query;

  if (!predictionId || typeof predictionId !== 'string') {
    return res.status(400).json({ error: 'Prediction ID is required' });
  }

  // Determine media type for error messages (default to 'video')
  const mediaType: 'video' | 'music' = type === 'music' ? 'music' : 'video';

  // Validate prediction ID format (UUID-like)
  if (!/^[a-z0-9]{20,}$/i.test(predictionId)) {
    return res.status(400).json({ error: 'Invalid prediction ID format' });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REPLICATE_REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Token ${REPLICATE_API_TOKEN}`,
          },
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          success: false,
          status: 'failed',
          error: 'Prediction not found',
        });
      }
      return res.status(500).json({
        success: false,
        status: 'failed',
        error: 'Failed to check prediction status',
      });
    }

    const prediction: ReplicatePrediction = await response.json();

    const output = prediction.output
      ? Array.isArray(prediction.output)
        ? prediction.output[0]
        : prediction.output
      : undefined;

    return res.status(200).json({
      success: prediction.status === 'succeeded',
      status: prediction.status,
      output,
      error: prediction.error ? sanitizeGenerationError(prediction.error, mediaType) : undefined,
    });
  } catch (error) {
    console.error('[prediction-status] Error:', error);
    return res.status(500).json({
      success: false,
      status: 'failed',
      error: sanitizeGenerationError(error, mediaType),
    });
  }
}

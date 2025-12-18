import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuthWithCSRF, checkRateLimit } from '@/utils/api-auth';
import { getUserCredits, deductCredits, CreditError } from '@/utils/db';
import {
  produceSeries,
  produceMovie,
  estimateSeriesCredits,
  estimateMovieCredits,
  type SeriesConfig,
  type MovieConfig,
  type BatchProductionResult,
} from '@/services/production/series';
import type { CinemaProductionSettings, ApiError } from '@/types';

interface ProduceBatchResponse {
  success: boolean;
  type?: 'series' | 'movie';
  title?: string;
  videos?: BatchProductionResult['videos'];
  totalDuration?: number;
  creditsUsed?: number;
  creditsRemaining?: number;
  estimatedCredits?: number;
  progress?: BatchProductionResult['progress'];
  error?: string;
}

// Validation constants
const MAX_EPISODES = 12;
const MAX_ACTS = 5;
const MAX_EPISODE_DURATION = 180; // 3 minutes per episode
const MAX_MOVIE_DURATION = 30; // 30 minutes max

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProduceBatchResponse | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Require authentication with CSRF protection
  const userId = await requireAuthWithCSRF(req, res);
  if (!userId) return;

  // Rate limiting: 1 batch production per 30 minutes per user
  if (!checkRateLimit(`produce-batch:${userId}`, 1, 1800000)) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Batch productions are limited to once per 30 minutes.',
    });
  }

  const {
    projectId,
    type,
    seriesConfig,
    movieConfig,
    settings,
    estimateOnly,
  } = req.body;

  // Validate required fields
  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  if (!type || (type !== 'series' && type !== 'movie')) {
    return res.status(400).json({ error: 'type must be "series" or "movie"' });
  }

  // Validate based on type
  if (type === 'series') {
    if (!seriesConfig) {
      return res.status(400).json({ error: 'seriesConfig is required for series production' });
    }

    const config = seriesConfig as SeriesConfig;

    // Validate series config
    if (!config.title || typeof config.title !== 'string') {
      return res.status(400).json({ error: 'seriesConfig.title is required' });
    }
    if (!config.synopsis || typeof config.synopsis !== 'string') {
      return res.status(400).json({ error: 'seriesConfig.synopsis is required' });
    }
    if (!config.episodes || !Array.isArray(config.episodes) || config.episodes.length === 0) {
      return res.status(400).json({ error: 'seriesConfig.episodes is required and must not be empty' });
    }
    if (config.episodes.length > MAX_EPISODES) {
      return res.status(400).json({ error: `Maximum ${MAX_EPISODES} episodes allowed per batch` });
    }
    if (config.episodeDuration && config.episodeDuration > MAX_EPISODE_DURATION) {
      return res.status(400).json({ error: `Maximum episode duration is ${MAX_EPISODE_DURATION} seconds` });
    }

    // Validate each episode
    for (let i = 0; i < config.episodes.length; i++) {
      const episode = config.episodes[i];
      if (!episode.episodeNumber || !episode.title || !episode.synopsis) {
        return res.status(400).json({
          error: `Episode ${i + 1} is missing required fields (episodeNumber, title, synopsis)`,
        });
      }
    }

    // Estimate credits
    const creditEstimate = estimateSeriesCredits(config);

    if (estimateOnly) {
      return res.status(200).json({
        success: true,
        type: 'series',
        estimatedCredits: creditEstimate.total,
      });
    }

    // Check user credits
    const userCredits = await getUserCredits(userId);
    if (!userCredits || userCredits.creditsRemaining < creditEstimate.total) {
      return res.status(402).json({
        error: `Insufficient credits. This production requires approximately ${creditEstimate.total} credits.`,
        estimatedCredits: creditEstimate.total,
      });
    }

    try {
      const result = await produceSeries({
        projectId: projectId.trim(),
        userId,
        type: 'series',
        config,
        settings: settings as CinemaProductionSettings,
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error,
          progress: result.progress,
        });
      }

      // Deduct credits
      if (result.totalCreditsUsed > 0) {
        try {
          const deductResult = await deductCredits(
            userId,
            result.totalCreditsUsed,
            `Series production: ${config.title} (${result.videos.length} episodes)`,
            projectId,
            'generation'
          );

          return res.status(200).json({
            success: true,
            type: 'series',
            title: result.title,
            videos: result.videos,
            totalDuration: result.totalDuration,
            creditsUsed: result.totalCreditsUsed,
            creditsRemaining: deductResult.creditsRemaining,
            progress: result.progress,
          });
        } catch (error) {
          if (error instanceof CreditError && error.code === 'DB_UNAVAILABLE') {
            return res.status(200).json({
              success: true,
              type: 'series',
              title: result.title,
              videos: result.videos,
              totalDuration: result.totalDuration,
              creditsUsed: result.totalCreditsUsed,
              progress: result.progress,
              error: 'Credit deduction delayed - will be processed later',
            });
          }
          throw error;
        }
      }

      return res.status(200).json({
        success: true,
        type: 'series',
        title: result.title,
        videos: result.videos,
        totalDuration: result.totalDuration,
        creditsUsed: result.totalCreditsUsed,
        progress: result.progress,
      });

    } catch (error) {
      console.error('[produce-batch] Series error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Series production failed',
      });
    }

  } else if (type === 'movie') {
    if (!movieConfig) {
      return res.status(400).json({ error: 'movieConfig is required for movie production' });
    }

    const config = movieConfig as MovieConfig;

    // Validate movie config
    if (!config.title || typeof config.title !== 'string') {
      return res.status(400).json({ error: 'movieConfig.title is required' });
    }
    if (!config.synopsis || typeof config.synopsis !== 'string') {
      return res.status(400).json({ error: 'movieConfig.synopsis is required' });
    }
    if (config.targetDuration && config.targetDuration > MAX_MOVIE_DURATION) {
      return res.status(400).json({ error: `Maximum movie duration is ${MAX_MOVIE_DURATION} minutes` });
    }
    if (config.acts && config.acts.length > MAX_ACTS) {
      return res.status(400).json({ error: `Maximum ${MAX_ACTS} acts allowed` });
    }

    // Estimate credits
    const creditEstimate = estimateMovieCredits(config);

    if (estimateOnly) {
      return res.status(200).json({
        success: true,
        type: 'movie',
        estimatedCredits: creditEstimate.total,
      });
    }

    // Check user credits
    const userCredits = await getUserCredits(userId);
    if (!userCredits || userCredits.creditsRemaining < creditEstimate.total) {
      return res.status(402).json({
        error: `Insufficient credits. This production requires approximately ${creditEstimate.total} credits.`,
        estimatedCredits: creditEstimate.total,
      });
    }

    try {
      const result = await produceMovie({
        projectId: projectId.trim(),
        userId,
        type: 'movie',
        config,
        settings: settings as CinemaProductionSettings,
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error,
          progress: result.progress,
        });
      }

      // Deduct credits
      if (result.totalCreditsUsed > 0) {
        try {
          const deductResult = await deductCredits(
            userId,
            result.totalCreditsUsed,
            `Movie production: ${config.title} (${result.videos.length} acts)`,
            projectId,
            'generation'
          );

          return res.status(200).json({
            success: true,
            type: 'movie',
            title: result.title,
            videos: result.videos,
            totalDuration: result.totalDuration,
            creditsUsed: result.totalCreditsUsed,
            creditsRemaining: deductResult.creditsRemaining,
            progress: result.progress,
          });
        } catch (error) {
          if (error instanceof CreditError && error.code === 'DB_UNAVAILABLE') {
            return res.status(200).json({
              success: true,
              type: 'movie',
              title: result.title,
              videos: result.videos,
              totalDuration: result.totalDuration,
              creditsUsed: result.totalCreditsUsed,
              progress: result.progress,
              error: 'Credit deduction delayed - will be processed later',
            });
          }
          throw error;
        }
      }

      return res.status(200).json({
        success: true,
        type: 'movie',
        title: result.title,
        videos: result.videos,
        totalDuration: result.totalDuration,
        creditsUsed: result.totalCreditsUsed,
        progress: result.progress,
      });

    } catch (error) {
      console.error('[produce-batch] Movie error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Movie production failed',
      });
    }
  }
}

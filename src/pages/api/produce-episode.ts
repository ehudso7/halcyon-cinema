import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuthWithCSRF, checkRateLimit } from '@/utils/api-auth';
import { getUserCredits, deductCredits, CreditError } from '@/utils/db';
import {
  produceEpisode,
  quickProduce,
  isProductionConfigured,
  getMissingConfigurations,
  estimateProductionCredits,
  type ProductionRequest,
  type ProductionResult,
  type SceneInput,
} from '@/services/production';
import type { CinemaProductionSettings, ApiError } from '@/types';

interface ProduceEpisodeResponse {
  success: boolean;
  videoUrl?: string;
  duration?: number;
  creditsUsed?: number;
  creditsRemaining?: number;
  estimatedCredits?: number;
  progress?: ProductionResult['progress'];
  assets?: ProductionResult['assets'];
  error?: string;
  missingConfig?: string[];
}

// Validation constants
const MAX_DURATION_SECONDS = 300; // 5 minutes max
const MIN_DURATION_SECONDS = 10;
const MAX_SCENES = 20;
const MAX_PROMPT_LENGTH = 2000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProduceEpisodeResponse | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Check if production is configured
  if (!isProductionConfigured()) {
    const missing = getMissingConfigurations();
    return res.status(503).json({
      success: false,
      error: 'Full production is not fully configured.',
      missingConfig: missing,
    });
  }

  // Require authentication with CSRF protection
  const userId = await requireAuthWithCSRF(req, res);
  if (!userId) return;

  // Rate limiting: 1 production per 5 minutes per user
  if (!checkRateLimit(`produce:${userId}`, 1, 300000)) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait before starting another production.',
    });
  }

  const {
    projectId,
    prompt,
    scenes,
    title,
    genre,
    targetDuration,
    settings,
    estimateOnly,
    quickMode,
  } = req.body;

  // Validate required fields
  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  // Either prompt or scenes must be provided
  if (!prompt && (!scenes || !Array.isArray(scenes) || scenes.length === 0)) {
    return res.status(400).json({ error: 'Either prompt or scenes must be provided' });
  }

  // Validate prompt
  if (prompt) {
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt must be a non-empty string' });
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ error: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters` });
    }
  }

  // Validate scenes
  const validatedScenes: SceneInput[] = [];
  if (scenes && Array.isArray(scenes)) {
    if (scenes.length > MAX_SCENES) {
      return res.status(400).json({ error: `Maximum ${MAX_SCENES} scenes allowed` });
    }

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (!scene.id || !scene.description) {
        return res.status(400).json({ error: `Scene ${i} is missing required fields (id, description)` });
      }
      validatedScenes.push({
        id: String(scene.id),
        title: scene.title ? String(scene.title) : undefined,
        description: String(scene.description),
        dialogue: Array.isArray(scene.dialogue) ? scene.dialogue.map(String) : undefined,
        duration: typeof scene.duration === 'number' ? scene.duration : undefined,
        mood: scene.mood ? String(scene.mood) : undefined,
        setting: scene.setting ? String(scene.setting) : undefined,
      });
    }
  }

  // Validate duration
  let duration = typeof targetDuration === 'number' ? targetDuration : 30;
  duration = Math.max(MIN_DURATION_SECONDS, Math.min(MAX_DURATION_SECONDS, duration));

  // Validate settings
  const productionSettings: CinemaProductionSettings = settings || {};

  // Build production request
  const productionRequest: ProductionRequest = {
    projectId: projectId.trim(),
    userId,
    prompt: prompt?.trim(),
    scenes: validatedScenes.length > 0 ? validatedScenes : undefined,
    title: title ? String(title) : undefined,
    genre: genre ? String(genre) : undefined,
    targetDuration: duration,
    settings: productionSettings,
  };

  // Estimate credits
  const creditEstimate = estimateProductionCredits(productionRequest);

  // If estimate only, return the estimate
  if (estimateOnly) {
    return res.status(200).json({
      success: true,
      estimatedCredits: creditEstimate.total,
      // Include breakdown for transparency
      ...creditEstimate.breakdown,
    });
  }

  // Check user credits
  const userCredits = await getUserCredits(userId);
  if (!userCredits) {
    return res.status(403).json({ error: 'User not found or credits not available' });
  }

  if (userCredits.creditsRemaining < creditEstimate.total) {
    return res.status(402).json({
      error: `Insufficient credits. This production requires approximately ${creditEstimate.total} credits.`,
      creditsRemaining: userCredits.creditsRemaining,
      estimatedCredits: creditEstimate.total,
    });
  }

  try {
    let result: ProductionResult;

    if (quickMode && prompt) {
      // Quick produce mode - simplified one-click production
      result = await quickProduce(
        projectId.trim(),
        userId,
        prompt.trim(),
        duration,
        genre
      );
    } else {
      // Full production mode
      result = await produceEpisode(productionRequest);
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        progress: result.progress,
        creditsUsed: result.creditsUsed,
      });
    }

    // Deduct credits for successful production
    if (result.creditsUsed > 0) {
      try {
        const deductResult = await deductCredits(
          userId,
          result.creditsUsed,
          `Full episode production (${Math.round((result.duration || 0) / 60 * 10) / 10} min)`,
          productionRequest.projectId,
          'generation'
        );

        return res.status(200).json({
          success: true,
          videoUrl: result.videoUrl,
          duration: result.duration,
          creditsUsed: result.creditsUsed,
          creditsRemaining: deductResult.creditsRemaining,
          progress: result.progress,
          assets: result.assets,
        });
      } catch (error) {
        console.error('[produce-episode] Failed to deduct credits', {
          userId,
          creditsUsed: result.creditsUsed,
          error: error instanceof CreditError ? { code: error.code, message: error.message } : error,
        });

        if (error instanceof CreditError) {
          if (error.code === 'INSUFFICIENT_CREDITS') {
            return res.status(402).json({
              error: 'Insufficient credits. Your credits may have been used elsewhere.',
              creditsRemaining: 0,
            });
          }
          if (error.code === 'DB_UNAVAILABLE') {
            // Production succeeded but credit deduction failed - return success with warning
            return res.status(200).json({
              success: true,
              videoUrl: result.videoUrl,
              duration: result.duration,
              creditsUsed: result.creditsUsed,
              progress: result.progress,
              assets: result.assets,
              error: 'Credit deduction delayed - will be processed later',
            });
          }
        }

        return res.status(500).json({
          success: false,
          error: 'Failed to process credits. Please contact support.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      videoUrl: result.videoUrl,
      duration: result.duration,
      creditsUsed: result.creditsUsed,
      progress: result.progress,
      assets: result.assets,
    });

  } catch (error) {
    console.error('[produce-episode] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Production failed unexpectedly',
    });
  }
}

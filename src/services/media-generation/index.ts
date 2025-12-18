/**
 * Media Generation Service
 *
 * Centralized service for all media generation (video, audio, voiceover).
 * This service handles the actual API calls to Replicate and OpenAI.
 *
 * PRICING MODEL (Pay-as-you-go, app pays for itself):
 * - Video: ~$0.05-0.10/generation (Replicate) → charge 10-25 credits
 * - Music: ~$0.03-0.05/generation (Replicate MusicGen) → charge 5-10 credits
 * - Voiceover: ~$0.015/1K chars (OpenAI TTS) → charge 2 credits/1K chars
 *
 * This markup ensures the platform is self-sustaining.
 */

import { persistVideo, persistAudio } from '@/utils/media-storage';

// ============================================================================
// Configuration
// ============================================================================

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Timeouts
const REPLICATE_REQUEST_TIMEOUT_MS = 10000;
const OPENAI_TTS_TIMEOUT_MS = 30000;
const MAX_POLL_TIME_MS = 120000; // 2 minutes
const POLL_INTERVAL_MS = 3000;

// ============================================================================
// Types
// ============================================================================

export interface VideoGenerationOptions {
  prompt: string;
  imageUrl?: string;
  duration?: 'short' | 'long';
  aspectRatio?: '16:9' | '9:16' | '1:1';
  projectId?: string;
  sceneId?: string;
}

export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  predictionId?: string;
  error?: string;
  status?: 'processing' | 'completed' | 'failed';
}

export interface MusicGenerationOptions {
  prompt: string;
  duration?: number; // 5-30 seconds
  genre?: string;
  mood?: string;
  tempo?: string;
  projectId?: string;
  sceneId?: string;
}

export interface MusicGenerationResult {
  success: boolean;
  audioUrl?: string;
  predictionId?: string;
  duration?: number;
  error?: string;
  status?: 'processing' | 'completed' | 'failed';
}

export interface VoiceoverGenerationOptions {
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  model?: 'tts-1' | 'tts-1-hd';
  speed?: number; // 0.25 - 4.0
  projectId?: string;
  sceneId?: string;
}

export interface VoiceoverGenerationResult {
  success: boolean;
  audioUrl?: string;
  duration?: number;
  error?: string;
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
}

// ============================================================================
// Service Configuration Check
// ============================================================================

export function isVideoGenerationConfigured(): boolean {
  return !!REPLICATE_API_TOKEN;
}

export function isMusicGenerationConfigured(): boolean {
  return !!REPLICATE_API_TOKEN;
}

export function isVoiceoverGenerationConfigured(): boolean {
  return !!OPENAI_API_KEY;
}

// ============================================================================
// Video Generation
// ============================================================================

/**
 * Generate video using Replicate.
 * Uses Stable Video Diffusion for image-to-video or Zeroscope for text-to-video.
 */
export async function generateVideo(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  if (!REPLICATE_API_TOKEN) {
    return {
      success: false,
      error: 'Video generation is not configured. Please set REPLICATE_API_TOKEN.',
    };
  }

  const { prompt, imageUrl, duration = 'short', aspectRatio = '16:9', projectId, sceneId } = options;

  try {
    // Choose model based on whether we have an image
    const modelVersion = imageUrl
      ? 'stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438'
      : 'anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351';

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

    // Start prediction
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
      console.error('[media-generation] Replicate video API error:', errorText);
      return {
        success: false,
        error: 'Failed to start video generation',
      };
    }

    const prediction: ReplicatePrediction = await response.json();

    // Poll for completion
    const finalPrediction = await pollReplicatePrediction(prediction.id);

    if (finalPrediction.status === 'succeeded' && finalPrediction.output) {
      let videoUrl = Array.isArray(finalPrediction.output)
        ? finalPrediction.output[0]
        : finalPrediction.output;

      // Persist to permanent storage if project context provided
      if (projectId && videoUrl) {
        try {
          videoUrl = await persistVideo(videoUrl, projectId, sceneId);
        } catch (persistError) {
          console.warn('[media-generation] Failed to persist video:', persistError);
        }
      }

      return {
        success: true,
        videoUrl,
        predictionId: prediction.id,
        status: 'completed',
      };
    } else if (finalPrediction.status === 'failed') {
      return {
        success: false,
        error: finalPrediction.error || 'Video generation failed',
        predictionId: prediction.id,
        status: 'failed',
      };
    } else {
      // Still processing - return false with processing status for polling
      return {
        success: false,
        predictionId: prediction.id,
        status: 'processing',
        error: 'Video generation is still in progress. Poll for updates.',
      };
    }
  } catch (error) {
    console.error('[media-generation] Video generation error:', error);
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return {
      success: false,
      error: isTimeout ? 'Video generation request timed out' : (error instanceof Error ? error.message : 'Failed to generate video'),
    };
  }
}

// ============================================================================
// Music Generation
// ============================================================================

/**
 * Generate music using Replicate MusicGen.
 * Cost: ~$0.03-0.05 per generation (charged as 5-10 credits).
 */
export async function generateMusic(
  options: MusicGenerationOptions
): Promise<MusicGenerationResult> {
  if (!REPLICATE_API_TOKEN) {
    return {
      success: false,
      error: 'Music generation is not configured. Please set REPLICATE_API_TOKEN.',
    };
  }

  const {
    prompt,
    duration = 10,
    genre,
    mood,
    tempo,
    projectId,
    sceneId,
  } = options;

  // Validate duration (5-30 seconds)
  const durationSeconds = Math.min(30, Math.max(5, Number(duration) || 10));

  try {
    // Build enhanced prompt
    let enhancedPrompt = prompt.trim();
    if (genre) enhancedPrompt += `, ${genre} genre`;
    if (mood) enhancedPrompt += `, ${mood} mood`;
    if (tempo) enhancedPrompt += `, ${tempo} tempo`;

    // Start prediction with MusicGen
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
      console.error('[media-generation] Replicate music API error:', errorText);
      return {
        success: false,
        error: 'Failed to start music generation',
      };
    }

    const prediction: ReplicatePrediction = await response.json();

    // Poll for completion
    const finalPrediction = await pollReplicatePrediction(prediction.id, 90000);

    if (finalPrediction.status === 'succeeded' && finalPrediction.output) {
      let audioUrl = Array.isArray(finalPrediction.output)
        ? finalPrediction.output[0]
        : finalPrediction.output;

      // Persist to permanent storage if project context provided
      if (projectId && audioUrl) {
        try {
          audioUrl = await persistAudio(audioUrl, projectId, sceneId);
        } catch (persistError) {
          console.warn('[media-generation] Failed to persist audio:', persistError);
        }
      }

      return {
        success: true,
        audioUrl,
        predictionId: prediction.id,
        duration: durationSeconds,
        status: 'completed',
      };
    } else if (finalPrediction.status === 'failed') {
      return {
        success: false,
        error: finalPrediction.error || 'Music generation failed',
        predictionId: prediction.id,
        status: 'failed',
      };
    } else {
      // Still processing - return false with processing status for polling
      return {
        success: false,
        predictionId: prediction.id,
        status: 'processing',
        error: 'Music generation is still in progress. Poll for updates.',
      };
    }
  } catch (error) {
    console.error('[media-generation] Music generation error:', error);
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return {
      success: false,
      error: isTimeout ? 'Music generation request timed out' : (error instanceof Error ? error.message : 'Failed to generate music'),
    };
  }
}

// ============================================================================
// Voiceover Generation
// ============================================================================

/**
 * Generate voiceover using OpenAI TTS.
 * Cost: $0.015/1K chars (tts-1) or $0.030/1K chars (tts-1-hd).
 * This is the cheapest high-quality TTS option available.
 */
export async function generateVoiceover(
  options: VoiceoverGenerationOptions
): Promise<VoiceoverGenerationResult> {
  if (!OPENAI_API_KEY) {
    return {
      success: false,
      error: 'Voiceover generation is not configured. Please set OPENAI_API_KEY.',
    };
  }

  const {
    text,
    voice = 'nova',
    model = 'tts-1',
    speed = 1.0,
    // Reserved for future persistence support
    projectId: _projectId,
    sceneId: _sceneId,
  } = options;
  void _projectId;
  void _sceneId;

  const trimmedText = text.trim();
  if (!trimmedText) {
    return {
      success: false,
      error: 'Text is required for voiceover generation',
    };
  }

  if (trimmedText.length > 4096) {
    return {
      success: false,
      error: 'Text exceeds maximum length of 4096 characters',
    };
  }

  const speedNum = Math.min(4.0, Math.max(0.25, Number(speed) || 1.0));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TTS_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: trimmedText,
          voice,
          response_format: 'mp3',
          speed: speedNum,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[media-generation] OpenAI TTS API error:', errorData);
      return {
        success: false,
        error: (errorData as { error?: { message?: string } }).error?.message || 'Failed to generate voiceover',
      };
    }

    // Get the audio buffer
    const audioBuffer = Buffer.from(await response.arrayBuffer());

    // For voiceover, we return a base64 data URL by default
    // Can be persisted to storage if needed
    let audioUrl = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;

    // If project context is provided, we could persist to storage
    // For now, voiceovers are typically smaller and can be stored as data URLs

    // Estimate duration: ~150 words/min or ~750 chars/min
    const estimatedDuration = Math.round((trimmedText.length / 750) * 60 / speedNum);

    return {
      success: true,
      audioUrl,
      duration: estimatedDuration,
    };
  } catch (error) {
    console.error('[media-generation] Voiceover generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate voiceover',
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Poll Replicate prediction until completion or timeout.
 */
async function pollReplicatePrediction(
  predictionId: string,
  maxWaitTime: number = MAX_POLL_TIME_MS
): Promise<ReplicatePrediction> {
  const startTime = Date.now();
  let prediction: ReplicatePrediction = {
    id: predictionId,
    status: 'processing',
  };

  while (
    prediction.status !== 'succeeded' &&
    prediction.status !== 'failed' &&
    prediction.status !== 'canceled' &&
    Date.now() - startTime < maxWaitTime
  ) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REPLICATE_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Token ${REPLICATE_API_TOKEN}`,
          },
          signal: controller.signal,
        }
      );

      if (response.ok) {
        prediction = await response.json();
      }
    } catch {
      // Ignore timeout errors during polling, will retry
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return prediction;
}

// ============================================================================
// Credit Cost Calculations
// ============================================================================

/**
 * Calculate credit cost for video generation.
 * Based on Replicate pricing (~$0.05-0.10/generation).
 */
export function getVideoCreditCost(quality: 'standard' | 'professional' | 'premium'): number {
  const costs = {
    standard: 10,
    professional: 15,
    premium: 25,
  };
  return costs[quality];
}

/**
 * Calculate credit cost for music generation.
 * Based on Replicate MusicGen pricing (~$0.03-0.05/generation).
 */
export function getMusicCreditCost(quality: 'standard' | 'professional' | 'premium'): number {
  const costs = {
    standard: 5,
    professional: 7,
    premium: 10,
  };
  return costs[quality];
}

/**
 * Calculate credit cost for voiceover generation.
 * Based on OpenAI TTS pricing ($0.015/1K chars for tts-1).
 */
export function getVoiceoverCreditCost(textLength: number): number {
  // 2 credits per 1000 characters
  return Math.max(1, Math.ceil((textLength / 1000) * 2));
}

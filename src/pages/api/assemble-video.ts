import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, requireAuthWithCSRF, checkRateLimit } from '@/utils/api-auth';
import { deductCredits, getUserCredits, CreditError } from '@/utils/db';
import {
  assembleVideo,
  isAssemblyConfigured,
  estimateAssemblyCredits,
  getAssemblyStatus,
  type AssemblyOptions,
  type VideoClip,
  type AudioTrack,
  type TextOverlay,
} from '@/services/video-assembly';
import { ApiError } from '@/types';

interface AssembleVideoResponse {
  success: boolean;
  videoUrl?: string;
  renderId?: string;
  duration?: number;
  creditsUsed?: number;
  creditsRemaining?: number;
  status?: 'queued' | 'rendering' | 'completed' | 'failed';
  error?: string;
  estimatedCredits?: number;
}

// Valid values for validation
const VALID_RESOLUTIONS = ['720p', '1080p', '4k'] as const;
const VALID_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3'] as const;
const VALID_TRANSITIONS = ['cut', 'fade', 'dissolve', 'wipe'] as const;
const VALID_FORMATS = ['mp4', 'webm', 'gif'] as const;
const VALID_QUALITIES = ['low', 'medium', 'high'] as const;
const VALID_AUDIO_TYPES = ['music', 'voiceover', 'sfx'] as const;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AssembleVideoResponse | ApiError>
) {
  // Handle GET for status checking
  if (req.method === 'GET') {
    // Require authentication for status checks (no CSRF needed for GET)
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const { renderId } = req.query;

    if (!renderId || typeof renderId !== 'string') {
      return res.status(400).json({ error: 'renderId is required' });
    }

    if (!isAssemblyConfigured()) {
      return res.status(503).json({
        error: 'Video assembly is not configured. Please set SHOTSTACK_API_KEY.',
      });
    }

    const status = await getAssemblyStatus(renderId);

    return res.status(200).json({
      success: status.status === 'completed',
      status: status.status,
      videoUrl: status.videoUrl,
      error: status.error,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  if (!isAssemblyConfigured()) {
    return res.status(503).json({
      error: 'Video assembly is not configured. Please set SHOTSTACK_API_KEY.',
    });
  }

  // Require authentication with CSRF protection
  const userId = await requireAuthWithCSRF(req, res);
  if (!userId) return;

  // Rate limiting: 3 assembly jobs per minute per user
  if (!checkRateLimit(`assembly:${userId}`, 3, 60000)) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait before starting more assembly jobs.',
    });
  }

  const {
    projectId,
    sceneId,
    clips,
    audioTracks,
    textOverlays,
    resolution,
    aspectRatio,
    fps,
    transitionType,
    transitionDuration,
    format,
    quality,
    estimateOnly,
  } = req.body;

  // Validate required fields
  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  if (!clips || !Array.isArray(clips) || clips.length === 0) {
    return res.status(400).json({ error: 'At least one video clip is required' });
  }

  // Validate clips
  const validatedClips: VideoClip[] = [];
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (!clip.url || typeof clip.url !== 'string') {
      return res.status(400).json({ error: `Clip ${i} is missing a valid URL` });
    }
    validatedClips.push({
      url: clip.url,
      startTime: typeof clip.startTime === 'number' ? clip.startTime : undefined,
      duration: typeof clip.duration === 'number' ? Math.max(0.5, clip.duration) : undefined,
      trimStart: typeof clip.trimStart === 'number' ? clip.trimStart : undefined,
      trimEnd: typeof clip.trimEnd === 'number' ? clip.trimEnd : undefined,
    });
  }

  // Validate audio tracks if provided
  const validatedAudioTracks: AudioTrack[] = [];
  if (audioTracks && Array.isArray(audioTracks)) {
    for (let i = 0; i < audioTracks.length; i++) {
      const track = audioTracks[i];
      if (!track.url || typeof track.url !== 'string') {
        return res.status(400).json({ error: `Audio track ${i} is missing a valid URL` });
      }
      if (track.type && !VALID_AUDIO_TYPES.includes(track.type)) {
        return res.status(400).json({
          error: `Invalid audio type. Must be one of: ${VALID_AUDIO_TYPES.join(', ')}`,
        });
      }
      validatedAudioTracks.push({
        url: track.url,
        type: track.type || 'music',
        volume: typeof track.volume === 'number' ? Math.max(0, Math.min(1, track.volume)) : undefined,
        startTime: typeof track.startTime === 'number' ? track.startTime : undefined,
        fadeIn: typeof track.fadeIn === 'number' ? track.fadeIn : undefined,
        fadeOut: typeof track.fadeOut === 'number' ? track.fadeOut : undefined,
        loop: typeof track.loop === 'boolean' ? track.loop : undefined,
      });
    }
  }

  // Validate text overlays if provided
  const validatedTextOverlays: TextOverlay[] = [];
  if (textOverlays && Array.isArray(textOverlays)) {
    for (let i = 0; i < textOverlays.length; i++) {
      const overlay = textOverlays[i];
      if (!overlay.text || typeof overlay.text !== 'string') {
        return res.status(400).json({ error: `Text overlay ${i} is missing text` });
      }
      if (typeof overlay.startTime !== 'number' || typeof overlay.duration !== 'number') {
        return res.status(400).json({ error: `Text overlay ${i} is missing timing` });
      }
      validatedTextOverlays.push({
        text: overlay.text,
        startTime: overlay.startTime,
        duration: overlay.duration,
        position: overlay.position,
        style: overlay.style,
        fontSize: overlay.fontSize,
        color: overlay.color,
      });
    }
  }

  // Validate optional settings
  if (resolution && !VALID_RESOLUTIONS.includes(resolution)) {
    return res.status(400).json({
      error: `Invalid resolution. Must be one of: ${VALID_RESOLUTIONS.join(', ')}`,
    });
  }

  if (aspectRatio && !VALID_ASPECT_RATIOS.includes(aspectRatio)) {
    return res.status(400).json({
      error: `Invalid aspectRatio. Must be one of: ${VALID_ASPECT_RATIOS.join(', ')}`,
    });
  }

  if (transitionType && !VALID_TRANSITIONS.includes(transitionType)) {
    return res.status(400).json({
      error: `Invalid transitionType. Must be one of: ${VALID_TRANSITIONS.join(', ')}`,
    });
  }

  if (format && !VALID_FORMATS.includes(format)) {
    return res.status(400).json({
      error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}`,
    });
  }

  if (quality && !VALID_QUALITIES.includes(quality)) {
    return res.status(400).json({
      error: `Invalid quality. Must be one of: ${VALID_QUALITIES.join(', ')}`,
    });
  }

  // Build assembly options
  const assemblyOptions: AssemblyOptions = {
    projectId: projectId.trim(),
    sceneId: sceneId?.trim(),
    clips: validatedClips,
    audioTracks: validatedAudioTracks.length > 0 ? validatedAudioTracks : undefined,
    textOverlays: validatedTextOverlays.length > 0 ? validatedTextOverlays : undefined,
    resolution: resolution || '1080p',
    aspectRatio: aspectRatio || '16:9',
    fps: typeof fps === 'number' ? Math.max(24, Math.min(60, fps)) : 30,
    transitionType: transitionType || 'fade',
    transitionDuration: typeof transitionDuration === 'number' ? transitionDuration : 0.5,
    format: format || 'mp4',
    quality: quality || 'high',
  };

  // Estimate credits
  const estimatedCredits = estimateAssemblyCredits(assemblyOptions);

  // If estimate only, return the estimate
  if (estimateOnly) {
    return res.status(200).json({
      success: true,
      estimatedCredits,
    });
  }

  // Check user credits
  const userCredits = await getUserCredits(userId);
  if (!userCredits) {
    return res.status(403).json({ error: 'User not found or credits not available' });
  }

  if (userCredits.creditsRemaining < estimatedCredits) {
    return res.status(402).json({
      error: `Insufficient credits. This assembly requires approximately ${estimatedCredits} credits.`,
      creditsRemaining: userCredits.creditsRemaining,
      estimatedCredits,
    });
  }

  try {
    // Start assembly
    const result = await assembleVideo(assemblyOptions);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    // If completed, deduct credits
    if (result.status === 'completed' && result.creditsUsed) {
      try {
        const deductResult = await deductCredits(
          userId,
          result.creditsUsed,
          `Video assembly (${Math.ceil((result.duration || 0) / 60)} min)`,
          result.renderId,
          'generation'
        );

        return res.status(200).json({
          success: true,
          videoUrl: result.videoUrl,
          renderId: result.renderId,
          duration: result.duration,
          creditsUsed: result.creditsUsed,
          creditsRemaining: deductResult.creditsRemaining,
          status: 'completed',
        });
      } catch (error) {
        console.error('[assemble-video] Failed to deduct credits', {
          userId,
          renderId: result.renderId,
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
    }

    // Still processing - return render ID for polling
    return res.status(202).json({
      success: true,
      renderId: result.renderId,
      status: result.status,
      estimatedCredits,
      creditsRemaining: userCredits.creditsRemaining,
    });
  } catch (error) {
    console.error('[assemble-video] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assemble video',
    });
  }
}

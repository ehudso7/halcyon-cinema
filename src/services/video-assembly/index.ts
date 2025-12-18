/**
 * Video Assembly Service
 *
 * Assembles generated video clips, music, and voiceover into a final video.
 * Uses Shotstack API for cloud-based video rendering.
 *
 * PRICING MODEL (Pay-as-you-go):
 * - Shotstack: ~$0.40/minute rendered
 * - User charge: 50 credits per minute of output (~60% margin)
 *
 * This enables full "prompt to watchable video" workflow.
 */

import { persistVideo } from '@/utils/media-storage';

// ============================================================================
// Configuration
// ============================================================================

const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY;
const SHOTSTACK_ENV = process.env.SHOTSTACK_ENV || 'v1'; // 'v1' for production, 'stage' for sandbox

// API endpoints
const SHOTSTACK_API_URL = SHOTSTACK_ENV === 'stage'
  ? 'https://api.shotstack.io/stage'
  : 'https://api.shotstack.io/v1';

// Timeouts
const RENDER_REQUEST_TIMEOUT_MS = 30000;
const MAX_POLL_TIME_MS = 600000; // 10 minutes for long videos
const POLL_INTERVAL_MS = 5000;

// Credit cost per minute of output video
const CREDITS_PER_MINUTE = 50;

// ============================================================================
// Types
// ============================================================================

export interface VideoClip {
  url: string;
  startTime?: number; // When to start in the timeline (seconds)
  duration?: number;  // Override clip duration
  trimStart?: number; // Trim from start of clip
  trimEnd?: number;   // Trim from end of clip
}

export interface AudioTrack {
  url: string;
  type: 'music' | 'voiceover' | 'sfx';
  volume?: number;    // 0-1, default 1
  startTime?: number; // When to start in the timeline
  fadeIn?: number;    // Fade in duration (seconds)
  fadeOut?: number;   // Fade out duration (seconds)
  loop?: boolean;     // Loop audio to fill video duration
}

export interface TextOverlay {
  text: string;
  startTime: number;
  duration: number;
  position?: 'top' | 'center' | 'bottom';
  style?: 'title' | 'subtitle' | 'caption';
  fontSize?: number;
  color?: string;
}

export interface AssemblyOptions {
  projectId: string;
  sceneId?: string;

  // Video settings
  resolution?: '720p' | '1080p' | '4k';
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  fps?: number;

  // Content
  clips: VideoClip[];
  audioTracks?: AudioTrack[];
  textOverlays?: TextOverlay[];

  // Transitions
  transitionType?: 'cut' | 'fade' | 'dissolve' | 'wipe';
  transitionDuration?: number; // seconds

  // Output
  format?: 'mp4' | 'webm' | 'gif';
  quality?: 'low' | 'medium' | 'high';
}

export interface AssemblyResult {
  success: boolean;
  videoUrl?: string;
  renderId?: string;
  duration?: number;    // Output duration in seconds
  creditsUsed?: number;
  status?: 'queued' | 'rendering' | 'completed' | 'failed';
  error?: string;
  progress?: number;    // 0-100
}

export interface AssemblyStatus {
  status: 'queued' | 'rendering' | 'completed' | 'failed';
  progress?: number;
  videoUrl?: string;
  error?: string;
}

// Shotstack API types
interface ShotstackClip {
  asset: {
    type: 'video' | 'audio' | 'title';
    src?: string;
    text?: string;
    volume?: number;
    trim?: number;
  };
  start: number;
  length: number;
  fit?: string;
  transition?: {
    in?: string;
    out?: string;
  };
}

interface ShotstackTrack {
  clips: ShotstackClip[];
}

interface ShotstackTimeline {
  tracks: ShotstackTrack[];
  background?: string;
}

interface ShotstackOutput {
  format: string;
  resolution: string;
  fps?: number;
  quality?: string;
}

interface ShotstackEdit {
  timeline: ShotstackTimeline;
  output: ShotstackOutput;
}

interface ShotstackRenderResponse {
  success: boolean;
  message: string;
  response: {
    id: string;
    status: string;
    url?: string;
  };
}

// ============================================================================
// Service Configuration Check
// ============================================================================

export function isAssemblyConfigured(): boolean {
  return !!SHOTSTACK_API_KEY;
}

export function getAssemblyCreditsPerMinute(): number {
  return CREDITS_PER_MINUTE;
}

/**
 * Estimate credits needed for an assembly job.
 */
export function estimateAssemblyCredits(options: AssemblyOptions): number {
  // Calculate total duration from clips
  let totalDuration = 0;

  for (const clip of options.clips) {
    const clipDuration = clip.duration || 5; // Default 5 seconds if not specified
    totalDuration += clipDuration;
  }

  // Account for transitions reducing total time slightly
  if (options.transitionType && options.transitionType !== 'cut') {
    const transitionTime = options.transitionDuration || 1;
    totalDuration -= (options.clips.length - 1) * transitionTime * 0.5;
  }

  // Convert to minutes and calculate credits
  const minutes = Math.max(0.5, totalDuration / 60); // Minimum 0.5 minute charge
  return Math.ceil(minutes * CREDITS_PER_MINUTE);
}

// ============================================================================
// Main Assembly Function
// ============================================================================

/**
 * Assemble video clips, audio, and overlays into a final video.
 */
export async function assembleVideo(
  options: AssemblyOptions
): Promise<AssemblyResult> {
  if (!SHOTSTACK_API_KEY) {
    return {
      success: false,
      error: 'Video assembly is not configured. Please set SHOTSTACK_API_KEY.',
    };
  }

  if (!options.clips || options.clips.length === 0) {
    return {
      success: false,
      error: 'At least one video clip is required for assembly.',
    };
  }

  try {
    // Build Shotstack edit specification
    const edit = buildShotstackEdit(options);

    // Submit render job
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RENDER_REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${SHOTSTACK_API_URL}/render`, {
        method: 'POST',
        headers: {
          'x-api-key': SHOTSTACK_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(edit),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[video-assembly] Shotstack API error:', errorText);
      return {
        success: false,
        error: 'Failed to start video assembly',
      };
    }

    const result: ShotstackRenderResponse = await response.json();

    if (!result.success || !result.response?.id) {
      return {
        success: false,
        error: result.message || 'Failed to queue render job',
      };
    }

    const renderId = result.response.id;

    // Poll for completion
    const finalStatus = await pollRenderStatus(renderId);

    if (finalStatus.status === 'completed' && finalStatus.videoUrl) {
      // Persist to permanent storage
      let videoUrl = finalStatus.videoUrl;
      try {
        videoUrl = await persistVideo(finalStatus.videoUrl, options.projectId, options.sceneId);
      } catch (persistError) {
        console.warn('[video-assembly] Failed to persist video:', persistError);
      }

      // Calculate credits used
      const creditsUsed = estimateAssemblyCredits(options);

      // Estimate duration from clips
      let duration = 0;
      for (const clip of options.clips) {
        duration += clip.duration || 5;
      }

      return {
        success: true,
        videoUrl,
        renderId,
        duration,
        creditsUsed,
        status: 'completed',
      };
    } else if (finalStatus.status === 'failed') {
      return {
        success: false,
        error: finalStatus.error || 'Video assembly failed',
        renderId,
        status: 'failed',
      };
    } else {
      // Still processing - return false with render ID for polling
      return {
        success: false,
        renderId,
        status: finalStatus.status as 'queued' | 'rendering',
        progress: finalStatus.progress,
        error: 'Video assembly is still in progress. Poll for updates.',
      };
    }
  } catch (error) {
    console.error('[video-assembly] Assembly error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assemble video',
    };
  }
}

/**
 * Check the status of a render job.
 */
export async function getAssemblyStatus(renderId: string): Promise<AssemblyStatus> {
  if (!SHOTSTACK_API_KEY) {
    return {
      status: 'failed',
      error: 'Video assembly is not configured.',
    };
  }

  try {
    const response = await fetch(`${SHOTSTACK_API_URL}/render/${renderId}`, {
      headers: {
        'x-api-key': SHOTSTACK_API_KEY,
      },
    });

    if (!response.ok) {
      return {
        status: 'failed',
        error: 'Failed to get render status',
      };
    }

    const result = await response.json();
    const renderStatus = result.response?.status;

    return {
      status: mapShotstackStatus(renderStatus),
      progress: result.response?.progress,
      videoUrl: result.response?.url,
      error: result.response?.error,
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Failed to check status',
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build Shotstack edit specification from assembly options.
 */
function buildShotstackEdit(options: AssemblyOptions): ShotstackEdit {
  const tracks: ShotstackTrack[] = [];

  // Video track
  const videoClips: ShotstackClip[] = [];
  let currentTime = 0;

  for (let i = 0; i < options.clips.length; i++) {
    const clip = options.clips[i];
    const clipDuration = clip.duration || 5;
    const startTime = clip.startTime ?? currentTime;

    const shotstackClip: ShotstackClip = {
      asset: {
        type: 'video',
        src: clip.url,
        trim: clip.trimStart,
      },
      start: startTime,
      length: clipDuration,
      fit: 'cover',
    };

    // Add transitions
    if (options.transitionType && options.transitionType !== 'cut') {
      const transitionName = mapTransitionType(options.transitionType);
      if (i > 0) {
        shotstackClip.transition = { in: transitionName };
      }
      if (i < options.clips.length - 1) {
        shotstackClip.transition = {
          ...shotstackClip.transition,
          out: transitionName
        };
      }
    }

    videoClips.push(shotstackClip);
    currentTime = startTime + clipDuration;
  }

  tracks.push({ clips: videoClips });

  // Audio tracks
  if (options.audioTracks && options.audioTracks.length > 0) {
    // Music track (background)
    const musicClips: ShotstackClip[] = [];
    const voiceoverClips: ShotstackClip[] = [];

    for (const audio of options.audioTracks) {
      const audioClip: ShotstackClip = {
        asset: {
          type: 'audio',
          src: audio.url,
          volume: audio.type === 'music' ? (audio.volume ?? 0.3) : (audio.volume ?? 1),
        },
        start: audio.startTime ?? 0,
        length: currentTime, // Extend to video length
      };

      if (audio.type === 'music') {
        musicClips.push(audioClip);
      } else {
        voiceoverClips.push(audioClip);
      }
    }

    if (musicClips.length > 0) {
      tracks.push({ clips: musicClips });
    }
    if (voiceoverClips.length > 0) {
      tracks.push({ clips: voiceoverClips });
    }
  }

  // Text overlays
  if (options.textOverlays && options.textOverlays.length > 0) {
    const textClips: ShotstackClip[] = options.textOverlays.map(overlay => ({
      asset: {
        type: 'title',
        text: overlay.text,
      },
      start: overlay.startTime,
      length: overlay.duration,
    }));

    tracks.push({ clips: textClips });
  }

  // Build output settings
  const output: ShotstackOutput = {
    format: options.format || 'mp4',
    resolution: mapResolution(options.resolution || '1080p'),
    fps: options.fps || 30,
  };

  if (options.quality) {
    output.quality = options.quality;
  }

  return {
    timeline: {
      tracks,
      background: '#000000',
    },
    output,
  };
}

/**
 * Poll render status until completion or timeout.
 */
async function pollRenderStatus(renderId: string): Promise<AssemblyStatus> {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

    const status = await getAssemblyStatus(renderId);

    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }
  }

  return {
    status: 'failed',
    error: 'Render timed out after 10 minutes',
  };
}

/**
 * Map our transition types to Shotstack transition names.
 */
function mapTransitionType(type: string): string {
  const map: Record<string, string> = {
    fade: 'fade',
    dissolve: 'fade',
    wipe: 'wipeRight',
  };
  return map[type] || 'fade';
}

/**
 * Map our resolution to Shotstack resolution.
 */
function mapResolution(resolution: string): string {
  const map: Record<string, string> = {
    '720p': 'hd',
    '1080p': 'fhd', // Changed from '1080' to 'fhd' for Full HD
    '4k': 'uhd',    // Changed to 'uhd' for consistency
  };
  return map[resolution] || 'fhd';
}

/**
 * Map Shotstack status to our status.
 */
function mapShotstackStatus(status: string): 'queued' | 'rendering' | 'completed' | 'failed' {
  const map: Record<string, 'queued' | 'rendering' | 'completed' | 'failed'> = {
    queued: 'queued',
    fetching: 'queued',
    rendering: 'rendering',
    saving: 'rendering',
    done: 'completed',
    failed: 'failed',
  };
  return map[status] || 'rendering';
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick assembly for a simple sequence of clips with background music.
 */
export async function quickAssemble(
  projectId: string,
  clips: string[],        // Array of video URLs
  musicUrl?: string,      // Background music URL
  voiceoverUrl?: string,  // Voiceover URL
  options?: {
    resolution?: '720p' | '1080p' | '4k';
    transitionType?: 'cut' | 'fade' | 'dissolve';
  }
): Promise<AssemblyResult> {
  const videoClips: VideoClip[] = clips.map(url => ({
    url,
    duration: 5, // Default 5 seconds per clip
  }));

  const audioTracks: AudioTrack[] = [];

  if (musicUrl) {
    audioTracks.push({
      url: musicUrl,
      type: 'music',
      volume: 0.3,
      loop: true,
    });
  }

  if (voiceoverUrl) {
    audioTracks.push({
      url: voiceoverUrl,
      type: 'voiceover',
      volume: 1,
    });
  }

  return assembleVideo({
    projectId,
    clips: videoClips,
    audioTracks,
    resolution: options?.resolution || '1080p',
    transitionType: options?.transitionType || 'fade',
    transitionDuration: 0.5,
  });
}

/**
 * Assembly preset for cinematic scenes.
 */
export async function assembleCinematicScene(
  projectId: string,
  sceneId: string,
  shots: Array<{
    videoUrl: string;
    duration: number;
    description?: string;
  }>,
  audio?: {
    musicUrl?: string;
    voiceoverUrl?: string;
    musicVolume?: number;
  }
): Promise<AssemblyResult> {
  const videoClips: VideoClip[] = shots.map(shot => ({
    url: shot.videoUrl,
    duration: shot.duration,
  }));

  const audioTracks: AudioTrack[] = [];

  if (audio?.musicUrl) {
    audioTracks.push({
      url: audio.musicUrl,
      type: 'music',
      volume: audio.musicVolume ?? 0.25,
      fadeIn: 2,
      fadeOut: 2,
      loop: true,
    });
  }

  if (audio?.voiceoverUrl) {
    audioTracks.push({
      url: audio.voiceoverUrl,
      type: 'voiceover',
      volume: 1,
    });
  }

  return assembleVideo({
    projectId,
    sceneId,
    clips: videoClips,
    audioTracks,
    resolution: '1080p',
    aspectRatio: '16:9',
    transitionType: 'dissolve',
    transitionDuration: 0.8,
    format: 'mp4',
    quality: 'high',
  });
}

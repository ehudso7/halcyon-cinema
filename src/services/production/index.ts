/**
 * Full Production Orchestration Service
 *
 * Chains all generation steps to produce a complete watchable video from a prompt.
 *
 * WORKFLOW:
 * 1. Generate script/screenplay from prompt
 * 2. Break down into scenes and shots
 * 3. Generate video clips for each shot
 * 4. Generate background music
 * 5. Generate voiceover for dialogue/narration
 * 6. Assemble into final video
 *
 * This enables "prompt → watchable episode" in one click.
 */

import {
  generateVideo,
  generateMusic,
  generateVoiceover,
  isVideoGenerationConfigured,
  isMusicGenerationConfigured,
  isVoiceoverGenerationConfigured,
} from '@/services/media-generation';
import {
  assembleVideo,
  isAssemblyConfigured,
  estimateAssemblyCredits,
  type AssemblyOptions,
  type VideoClip,
  type AudioTrack,
} from '@/services/video-assembly';
import type { CinemaProductionSettings } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ProductionRequest {
  projectId: string;
  userId: string;

  // Content source - either provide scenes or generate from prompt
  prompt?: string;           // Generate script from this prompt
  scenes?: SceneInput[];     // Or provide pre-defined scenes

  // Production settings
  settings?: CinemaProductionSettings;

  // Episode metadata
  title?: string;
  genre?: string;
  targetDuration?: number;   // Target duration in seconds
}

export interface SceneInput {
  id: string;
  title?: string;
  description: string;
  dialogue?: string[];       // Character dialogue lines
  duration?: number;         // Scene duration in seconds
  mood?: string;
  setting?: string;
}

export interface ProductionProgress {
  stage: ProductionStage;
  progress: number;          // 0-100
  currentStep: string;
  completedSteps: string[];
  errors: string[];
}

export type ProductionStage =
  | 'initializing'
  | 'generating-script'
  | 'generating-shots'
  | 'generating-video'
  | 'generating-music'
  | 'generating-voiceover'
  | 'assembling'
  | 'completed'
  | 'failed';

export interface ProductionResult {
  success: boolean;
  videoUrl?: string;
  duration?: number;
  creditsUsed: number;
  progress: ProductionProgress;
  error?: string;

  // Generated assets (for reference/re-use)
  assets?: {
    videoClips: Array<{ sceneId: string; url: string; duration: number }>;
    musicTrack?: { url: string; duration: number };
    voiceoverTrack?: { url: string; duration: number };
  };
}

export interface GeneratedShot {
  id: string;
  sceneId: string;
  description: string;
  videoUrl?: string;
  duration: number;
  order: number;
}

// ============================================================================
// Production Orchestrator
// ============================================================================

/**
 * Check if full production is available (all services configured).
 */
export function isProductionConfigured(): boolean {
  return (
    isVideoGenerationConfigured() &&
    isMusicGenerationConfigured() &&
    isVoiceoverGenerationConfigured() &&
    isAssemblyConfigured()
  );
}

/**
 * Get list of missing configurations.
 */
export function getMissingConfigurations(): string[] {
  const missing: string[] = [];
  if (!isVideoGenerationConfigured()) missing.push('REPLICATE_API_TOKEN (video)');
  if (!isMusicGenerationConfigured()) missing.push('REPLICATE_API_TOKEN (music)');
  if (!isVoiceoverGenerationConfigured()) missing.push('OPENAI_API_KEY (voiceover)');
  if (!isAssemblyConfigured()) missing.push('SHOTSTACK_API_KEY (assembly)');
  return missing;
}

/**
 * Estimate total credits needed for a production.
 */
export function estimateProductionCredits(request: ProductionRequest): {
  total: number;
  breakdown: {
    video: number;
    music: number;
    voiceover: number;
    assembly: number;
  };
} {
  const scenes = request.scenes || [];
  const targetDuration = request.targetDuration || 60; // Default 1 minute

  // Estimate number of shots (2-3 shots per scene, or based on duration)
  const shotCount = scenes.length > 0
    ? scenes.length * 2.5
    : Math.ceil(targetDuration / 5); // ~5 seconds per shot

  // Video: 10 credits per shot (standard quality)
  const videoCost = Math.ceil(shotCount) * 10;

  // Music: 5 credits for background track
  const musicCost = 5;

  // Voiceover: estimate based on dialogue or duration
  // ~150 words per minute, ~5 chars per word = 750 chars per minute
  const voiceoverChars = scenes.reduce((acc, s) => {
    return acc + (s.dialogue?.join(' ').length || 0);
  }, 0) || (targetDuration / 60) * 500;
  const voiceoverCost = Math.max(2, Math.ceil(voiceoverChars / 1000) * 2);

  // Assembly: 50 credits per minute
  const assemblyMinutes = Math.max(0.5, targetDuration / 60);
  const assemblyCost = Math.ceil(assemblyMinutes * 50);

  return {
    total: videoCost + musicCost + voiceoverCost + assemblyCost,
    breakdown: {
      video: videoCost,
      music: musicCost,
      voiceover: voiceoverCost,
      assembly: assemblyCost,
    },
  };
}

/**
 * Main production function - orchestrates the full workflow.
 */
export async function produceEpisode(
  request: ProductionRequest,
  onProgress?: (progress: ProductionProgress) => void
): Promise<ProductionResult> {
  const progress: ProductionProgress = {
    stage: 'initializing',
    progress: 0,
    currentStep: 'Initializing production...',
    completedSteps: [],
    errors: [],
  };

  const updateProgress = (
    stage: ProductionStage,
    percent: number,
    step: string,
    completed?: string
  ) => {
    progress.stage = stage;
    progress.progress = percent;
    progress.currentStep = step;
    if (completed) progress.completedSteps.push(completed);
    onProgress?.(progress);
  };

  let creditsUsed = 0;
  const assets: ProductionResult['assets'] = {
    videoClips: [],
  };

  try {
    // Check configuration
    if (!isProductionConfigured()) {
      const missing = getMissingConfigurations();
      return {
        success: false,
        creditsUsed: 0,
        progress: { ...progress, stage: 'failed' },
        error: `Production not fully configured. Missing: ${missing.join(', ')}`,
      };
    }

    const settings = request.settings || {};
    const audioPrefs = settings.audioPreferences || {};
    const genPrefs = settings.generationPreferences || {};

    // =========================================================================
    // Step 1: Prepare scenes
    // =========================================================================
    updateProgress('generating-script', 5, 'Preparing scenes...');

    let scenes: SceneInput[] = request.scenes || [];

    // If no scenes provided, create a simple scene structure from the prompt
    if (scenes.length === 0 && request.prompt) {
      scenes = generateScenesFromPrompt(request.prompt, request.targetDuration || 60);
    }

    if (scenes.length === 0) {
      return {
        success: false,
        creditsUsed: 0,
        progress: { ...progress, stage: 'failed' },
        error: 'No scenes provided and no prompt to generate from',
      };
    }

    updateProgress('generating-script', 10, 'Scenes prepared', 'Scene preparation');

    // =========================================================================
    // Step 2: Generate shots for each scene
    // =========================================================================
    updateProgress('generating-shots', 15, 'Generating shot list...');

    const shots: GeneratedShot[] = [];
    let shotOrder = 0;

    for (const scene of scenes) {
      // Generate 2-3 shots per scene
      const shotCount = Math.ceil((scene.duration || 10) / 5);

      for (let i = 0; i < shotCount; i++) {
        shots.push({
          id: `shot-${scene.id}-${i}`,
          sceneId: scene.id,
          description: buildShotDescription(scene, i, shotCount),
          duration: 5,
          order: shotOrder++,
        });
      }
    }

    updateProgress('generating-shots', 20, 'Shot list generated', 'Shot breakdown');

    // =========================================================================
    // Step 3: Generate video for each shot
    // =========================================================================
    const totalShots = shots.length;
    let completedShots = 0;

    for (const shot of shots) {
      const shotProgress = 20 + ((completedShots / totalShots) * 40);
      updateProgress(
        'generating-video',
        shotProgress,
        `Generating video ${completedShots + 1}/${totalShots}: ${shot.description.substring(0, 50)}...`
      );

      const videoResult = await generateVideo({
        prompt: shot.description,
        duration: 'short',
        aspectRatio: '16:9',
        projectId: request.projectId,
        sceneId: shot.sceneId,
      });

      if (videoResult.success && videoResult.videoUrl) {
        shot.videoUrl = videoResult.videoUrl;
        assets.videoClips.push({
          sceneId: shot.sceneId,
          url: videoResult.videoUrl,
          duration: shot.duration,
        });
        creditsUsed += 10; // Standard video cost
      } else {
        progress.errors.push(`Failed to generate video for shot ${shot.id}: ${videoResult.error}`);
      }

      completedShots++;
    }

    updateProgress('generating-video', 60, 'Video clips generated', 'Video generation');

    // =========================================================================
    // Step 4: Generate background music
    // =========================================================================
    let musicUrl: string | undefined;
    let musicDuration = 0;

    if (audioPrefs.includeMusicTrack !== false) {
      updateProgress('generating-music', 65, 'Generating background music...');

      const totalDuration = shots.reduce((acc, s) => acc + s.duration, 0);
      const musicMood = genPrefs.musicMood || request.genre || 'cinematic';

      const musicResult = await generateMusic({
        prompt: `${musicMood} background music for ${request.genre || 'film'} scene`,
        duration: Math.min(30, totalDuration), // Max 30 seconds per generation
        mood: musicMood,
        genre: genPrefs.musicGenre || 'cinematic',
        projectId: request.projectId,
      });

      if (musicResult.success && musicResult.audioUrl) {
        musicUrl = musicResult.audioUrl;
        musicDuration = musicResult.duration || 30;
        assets.musicTrack = { url: musicUrl, duration: musicDuration };
        creditsUsed += 5;
      } else {
        progress.errors.push(`Failed to generate music: ${musicResult.error}`);
      }

      updateProgress('generating-music', 70, 'Background music generated', 'Music generation');
    }

    // =========================================================================
    // Step 5: Generate voiceover
    // =========================================================================
    let voiceoverUrl: string | undefined;
    let voiceoverDuration = 0;

    if (audioPrefs.includeVoiceover !== false) {
      // Collect all dialogue
      const allDialogue = scenes
        .flatMap(s => s.dialogue || [])
        .join('. ');

      if (allDialogue.length > 0) {
        updateProgress('generating-voiceover', 75, 'Generating voiceover...');

        const voiceResult = await generateVoiceover({
          text: allDialogue,
          voice: (audioPrefs.defaultVoice as 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer') || 'nova',
          model: 'tts-1',
          speed: 1.0,
          projectId: request.projectId,
        });

        if (voiceResult.success && voiceResult.audioUrl) {
          voiceoverUrl = voiceResult.audioUrl;
          voiceoverDuration = voiceResult.duration || 0;
          assets.voiceoverTrack = { url: voiceoverUrl, duration: voiceoverDuration };
          creditsUsed += Math.max(2, Math.ceil(allDialogue.length / 1000) * 2);
        } else {
          progress.errors.push(`Failed to generate voiceover: ${voiceResult.error}`);
        }

        updateProgress('generating-voiceover', 80, 'Voiceover generated', 'Voiceover generation');
      }
    }

    // =========================================================================
    // Step 6: Assemble final video
    // =========================================================================
    updateProgress('assembling', 85, 'Assembling final video...');

    // Filter shots that have video
    const successfulShots = shots.filter(s => s.videoUrl);

    if (successfulShots.length === 0) {
      return {
        success: false,
        creditsUsed,
        progress: { ...progress, stage: 'failed' },
        error: 'No video clips were successfully generated',
        assets,
      };
    }

    const videoClips: VideoClip[] = successfulShots.map(shot => ({
      url: shot.videoUrl!,
      duration: shot.duration,
    }));

    const audioTracks: AudioTrack[] = [];

    if (musicUrl) {
      audioTracks.push({
        url: musicUrl,
        type: 'music',
        volume: audioPrefs.musicVolume ?? 0.3,
        loop: true,
      });
    }

    if (voiceoverUrl) {
      audioTracks.push({
        url: voiceoverUrl,
        type: 'voiceover',
        volume: audioPrefs.voiceoverVolume ?? 1,
      });
    }

    const assemblyOptions: AssemblyOptions = {
      projectId: request.projectId,
      clips: videoClips,
      audioTracks: audioTracks.length > 0 ? audioTracks : undefined,
      resolution: settings.assemblyPreferences?.resolution || '1080p',
      aspectRatio: settings.assemblyPreferences?.aspectRatio || '16:9',
      transitionType: settings.assemblyPreferences?.transitionType || 'fade',
      transitionDuration: settings.assemblyPreferences?.transitionDuration || 0.5,
      format: settings.assemblyPreferences?.format || 'mp4',
      quality: settings.assemblyPreferences?.quality || 'high',
    };

    const assemblyResult = await assembleVideo(assemblyOptions);

    if (!assemblyResult.success) {
      return {
        success: false,
        creditsUsed,
        progress: { ...progress, stage: 'failed' },
        error: `Assembly failed: ${assemblyResult.error}`,
        assets,
      };
    }

    creditsUsed += assemblyResult.creditsUsed || estimateAssemblyCredits(assemblyOptions);

    updateProgress('assembling', 95, 'Video assembled', 'Final assembly');

    // =========================================================================
    // Complete!
    // =========================================================================
    updateProgress('completed', 100, 'Production complete!', 'Production');

    return {
      success: true,
      videoUrl: assemblyResult.videoUrl,
      duration: assemblyResult.duration,
      creditsUsed,
      progress,
      assets,
    };

  } catch (error) {
    console.error('[production] Unexpected error:', error);
    progress.stage = 'failed';
    progress.errors.push(error instanceof Error ? error.message : 'Unknown error');

    return {
      success: false,
      creditsUsed,
      progress,
      error: error instanceof Error ? error.message : 'Production failed unexpectedly',
      assets,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate simple scene structure from a prompt.
 * For a full implementation, this would use AI to generate a proper screenplay.
 */
function generateScenesFromPrompt(prompt: string, targetDuration: number): SceneInput[] {
  // Simple scene breakdown based on duration
  const sceneCount = Math.max(1, Math.ceil(targetDuration / 20)); // ~20 seconds per scene
  const scenes: SceneInput[] = [];

  for (let i = 0; i < sceneCount; i++) {
    scenes.push({
      id: `scene-${i + 1}`,
      title: `Scene ${i + 1}`,
      description: i === 0
        ? `Opening: ${prompt}`
        : i === sceneCount - 1
          ? `Conclusion: ${prompt}`
          : `Development: ${prompt}`,
      duration: Math.min(20, targetDuration / sceneCount),
      mood: 'cinematic',
    });
  }

  return scenes;
}

/**
 * Build a visual description for a shot.
 */
function buildShotDescription(scene: SceneInput, shotIndex: number, totalShots: number): string {
  const shotTypes = ['establishing wide shot', 'medium shot', 'close-up', 'dynamic tracking shot'];
  const shotType = shotTypes[shotIndex % shotTypes.length];

  const parts = [
    shotType,
    scene.description,
    scene.setting ? `in ${scene.setting}` : '',
    scene.mood ? `${scene.mood} mood` : '',
    'cinematic, high quality, 8K',
  ].filter(Boolean);

  // Vary based on position
  if (shotIndex === 0) {
    parts.unshift('Opening');
  } else if (shotIndex === totalShots - 1) {
    parts.unshift('Final');
  }

  return parts.join(', ');
}

/**
 * Quick produce - simplified version for one-click production.
 */
export async function quickProduce(
  projectId: string,
  userId: string,
  prompt: string,
  durationSeconds: number = 30,
  genre?: string
): Promise<ProductionResult> {
  return produceEpisode({
    projectId,
    userId,
    prompt,
    genre,
    targetDuration: durationSeconds,
    settings: {
      autoAssemble: true,
      audioPreferences: {
        includeMusicTrack: true,
        includeVoiceover: false, // No voiceover for quick produce
        musicVolume: 0.4,
      },
      assemblyPreferences: {
        resolution: '1080p',
        transitionType: 'fade',
        quality: 'high',
      },
    },
  });
}

/**
 * Cinema Service
 *
 * This service handles all cinema-related functionality including:
 * - Scene to shot translation
 * - Cinematic prompt generation
 * - Visual previews
 * - Mood boards
 * - Pitch decks
 * - Production bibles
 *
 * ARCHITECTURE CONSTRAINTS:
 * - Cinema lives at: /src/services/cinema
 * - Cinema NEVER imports Writer's Room internals
 * - Cinema only accesses Writer's Room through the public adapter
 * - Scene semantic data is obtained via WritersRoomAdapter.extractSemanticScene()
 *
 * IMPORTANT: Cinema is an OPTIONAL escalation. Users can use literary works
 * mode or Writer's Room mode indefinitely without ever touching Cinema features.
 */

import { SubscriptionTier, hasFeatureAccess, canUseCinema, ProjectMode } from '@/config/feature-flags';
import { dbGetProjectById, dbGetProjectLore } from '@/utils/db';
import { dbGetProjectChapters, dbGetChapterScenes } from '@/utils/db-literary';
import {
  generateVideo as generateVideoMedia,
  generateMusic as generateMusicMedia,
  generateVoiceover as generateVoiceoverMedia,
  isVideoGenerationConfigured,
  isMusicGenerationConfigured,
  isVoiceoverGenerationConfigured,
  getVideoCreditCost,
  getMusicCreditCost,
  getVoiceoverCreditCost,
} from '@/services/media-generation';
import type {
  SemanticSceneOutput,
  CinematicShot,
  ShotTemplate,
  MediaType,
  Chapter,
  ChapterScene,
} from '@/types/literary';
import type { Character, Scene, LoreEntry, Project } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface CinemaContext {
  userId: string;
  projectId: string;
  tier: SubscriptionTier;
  mode: ProjectMode;
}

export interface CinemaError {
  code: 'FEATURE_DISABLED' | 'INSUFFICIENT_TIER' | 'INVALID_MODE' | 'TRANSLATION_ERROR';
  message: string;
  details?: unknown;
}

export interface TranslationResult {
  success: boolean;
  shots: CinematicShot[];
  error?: string;
}

export interface VisualPreviewResult {
  success: boolean;
  imageUrl?: string;
  prompt?: string;
  error?: string;
  creditsUsed: number;
}

export interface MoodBoardResult {
  success: boolean;
  images: Array<{
    url: string;
    prompt: string;
    mood: string;
  }>;
  error?: string;
  creditsUsed: number;
}

// ============================================================================
// Shot Templates
// ============================================================================

export const SHOT_TEMPLATES: Record<MediaType, ShotTemplate> = {
  film: {
    mediaType: 'film',
    shotTypes: [
      'establishing', 'wide', 'medium', 'close-up', 'extreme-close-up',
      'over-the-shoulder', 'two-shot', 'point-of-view', 'insert', 'cutaway',
      'tracking', 'dolly', 'crane', 'aerial', 'handheld'
    ],
    aspectRatios: ['2.39:1', '1.85:1', '16:9'],
    stylePresets: [
      'cinematic', 'noir', 'naturalistic', 'stylized', 'documentary',
      'blockbuster', 'indie', 'arthouse'
    ],
  },
  tv: {
    mediaType: 'tv',
    shotTypes: [
      'establishing', 'wide', 'medium', 'close-up', 'two-shot',
      'over-the-shoulder', 'insert', 'cutaway', 'reaction'
    ],
    aspectRatios: ['16:9', '2.0:1'],
    stylePresets: [
      'broadcast', 'premium', 'sitcom', 'procedural', 'prestige',
      'streaming', 'limited-series'
    ],
  },
  animation: {
    mediaType: 'animation',
    shotTypes: [
      'establishing', 'wide', 'medium', 'close-up', 'extreme-close-up',
      'dynamic', 'speed-lines', 'impact', 'transition', 'montage'
    ],
    aspectRatios: ['16:9', '1.85:1', '4:3'],
    stylePresets: [
      '2d-traditional', '3d-cgi', 'anime', 'cartoon', 'stop-motion',
      'motion-graphics', 'mixed-media'
    ],
  },
  game: {
    mediaType: 'game',
    shotTypes: [
      'cinematic', 'gameplay', 'cutscene', 'dialogue', 'action',
      'exploration', 'menu', 'loading', 'victory', 'defeat'
    ],
    aspectRatios: ['16:9', '21:9', '4:3'],
    stylePresets: [
      'realistic', 'stylized', 'pixel-art', 'cel-shaded', 'photorealistic',
      'low-poly', 'hand-painted'
    ],
  },
};

// ============================================================================
// Feature Access Checks
// ============================================================================

/**
 * Check if Cinema features are available for the user.
 */
export function isCinemaAvailable(tier: SubscriptionTier): boolean {
  return canUseCinema(tier);
}

/**
 * Check if a specific Cinema feature is available.
 */
export function isFeatureAvailable(tier: SubscriptionTier, feature: keyof typeof featurePathMap): boolean {
  const path = featurePathMap[feature];
  return hasFeatureAccess(tier, path);
}

const featurePathMap = {
  sceneToShotTranslation: 'cinema.sceneToShotTranslation',
  cinematicPromptGeneration: 'cinema.cinematicPromptGeneration',
  visualPreviews: 'cinema.visualPreviews',
  moodBoards: 'cinema.moodBoards',
  pitchDecks: 'cinema.pitchDecks',
  productionBibles: 'cinema.productionBibles',
  videoGeneration: 'cinema.videoGeneration',
  musicGeneration: 'cinema.musicGeneration',
  voiceoverGeneration: 'cinema.voiceoverGeneration',
} as const;

// ============================================================================
// Cinema Service Adapter
// ============================================================================

/**
 * Cinema Service Adapter
 *
 * This class provides the public API for all Cinema functionality.
 * It handles feature gating and delegates to internal components.
 */
export class CinemaAdapter {
  private context: CinemaContext;

  constructor(context: CinemaContext) {
    this.context = context;
  }

  /**
   * Check if Cinema is available for the current context.
   */
  isAvailable(): boolean {
    return isCinemaAvailable(this.context.tier);
  }

  /**
   * Validate that the user can use Cinema features.
   */
  private validateAccess(feature: keyof typeof featurePathMap): CinemaError | null {
    if (!this.isAvailable()) {
      return {
        code: 'INSUFFICIENT_TIER',
        message: 'Cinema features require a paid subscription',
      };
    }

    if (!isFeatureAvailable(this.context.tier, feature)) {
      return {
        code: 'FEATURE_DISABLED',
        message: `Feature '${feature}' is not available for your subscription tier`,
      };
    }

    if (this.context.mode !== 'cinema') {
      return {
        code: 'INVALID_MODE',
        message: 'Project must be in Cinema mode to use this feature',
      };
    }

    return null;
  }

  // ==========================================================================
  // Scene to Shot Translation
  // ==========================================================================

  /**
   * Translate a semantic scene to cinematic shots.
   *
   * This takes semantic output (obtained via WritersRoomAdapter.extractSemanticScene)
   * and generates shot breakdowns.
   */
  async translateSceneToShots(
    semanticScene: SemanticSceneOutput,
    mediaType: MediaType = 'film',
    options?: {
      style?: string;
      targetShotCount?: number;
    }
  ): Promise<TranslationResult> {
    const error = this.validateAccess('sceneToShotTranslation');
    if (error) {
      return {
        success: false,
        shots: [],
        error: error.message,
      };
    }

    return CinemaEngine.translateToShots(this.context, semanticScene, mediaType, options);
  }

  /**
   * Generate a cinematic prompt for a shot.
   */
  async generateCinematicPrompt(
    shot: Partial<CinematicShot>,
    style?: string
  ): Promise<{ success: boolean; prompt?: string; error?: string }> {
    const error = this.validateAccess('cinematicPromptGeneration');
    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return CinemaEngine.generatePrompt(shot, style);
  }

  // ==========================================================================
  // Visual Generation
  // ==========================================================================

  /**
   * Generate a visual preview for a shot.
   */
  async generateVisualPreview(shotId: string): Promise<VisualPreviewResult> {
    const error = this.validateAccess('visualPreviews');
    if (error) {
      return {
        success: false,
        error: error.message,
        creditsUsed: 0,
      };
    }

    return CinemaEngine.generatePreview(this.context, shotId);
  }

  /**
   * Generate a mood board for a scene or project.
   */
  async generateMoodBoard(
    themeOrSceneId: string,
    imageCount: number = 4
  ): Promise<MoodBoardResult> {
    const error = this.validateAccess('moodBoards');
    if (error) {
      return {
        success: false,
        images: [],
        error: error.message,
        creditsUsed: 0,
      };
    }

    return CinemaEngine.generateMoodBoard(this.context, themeOrSceneId, imageCount);
  }

  // ==========================================================================
  // Production Documents
  // ==========================================================================

  /**
   * Generate a pitch deck for the project.
   */
  async generatePitchDeck(): Promise<{
    success: boolean;
    deckUrl?: string;
    deckContent?: string;
    error?: string;
  }> {
    const error = this.validateAccess('pitchDecks');
    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return CinemaEngine.generatePitchDeck(this.context);
  }

  /**
   * Generate a production bible for the project.
   */
  async generateProductionBible(): Promise<{
    success: boolean;
    bibleUrl?: string;
    bibleContent?: string;
    error?: string;
  }> {
    const error = this.validateAccess('productionBibles');
    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return CinemaEngine.generateProductionBible(this.context);
  }

  // ==========================================================================
  // Media Generation
  // ==========================================================================

  /**
   * Generate video for a sequence.
   * Uses Replicate (Stable Video Diffusion or Zeroscope).
   */
  async generateVideo(
    sequenceId: string,
    options?: {
      prompt?: string;
      imageUrl?: string;
      quality?: 'standard' | 'professional' | 'premium';
    }
  ): Promise<{
    success: boolean;
    videoUrl?: string;
    error?: string;
    creditsUsed: number;
    predictionId?: string;
  }> {
    const error = this.validateAccess('videoGeneration');
    if (error) {
      return {
        success: false,
        error: error.message,
        creditsUsed: 0,
      };
    }

    return CinemaEngine.generateVideo(this.context, sequenceId, options);
  }

  /**
   * Generate music for a scene or project.
   * Uses Replicate MusicGen (cheapest option).
   */
  async generateMusic(
    mood: string,
    duration: number,
    options?: {
      genre?: string;
      tempo?: string;
      quality?: 'standard' | 'professional' | 'premium';
    }
  ): Promise<{
    success: boolean;
    audioUrl?: string;
    error?: string;
    creditsUsed: number;
    predictionId?: string;
  }> {
    const error = this.validateAccess('musicGeneration');
    if (error) {
      return {
        success: false,
        error: error.message,
        creditsUsed: 0,
      };
    }

    return CinemaEngine.generateMusic(this.context, mood, duration, options);
  }

  /**
   * Generate voiceover for text.
   * Uses OpenAI TTS (cheapest quality option at $0.015/1K chars).
   */
  async generateVoiceover(
    text: string,
    voiceId?: string,
    options?: {
      model?: 'tts-1' | 'tts-1-hd';
      speed?: number;
    }
  ): Promise<{
    success: boolean;
    audioUrl?: string;
    duration?: number;
    error?: string;
    creditsUsed: number;
  }> {
    const error = this.validateAccess('voiceoverGeneration');
    if (error) {
      return {
        success: false,
        error: error.message,
        creditsUsed: 0,
      };
    }

    return CinemaEngine.generateVoiceover(this.context, text, voiceId, options);
  }

  // ==========================================================================
  // Shot Template Access
  // ==========================================================================

  /**
   * Get shot template for a media type.
   */
  getShotTemplate(mediaType: MediaType): ShotTemplate {
    return SHOT_TEMPLATES[mediaType];
  }

  /**
   * Get all available shot types for a media type.
   */
  getShotTypes(mediaType: MediaType): string[] {
    return SHOT_TEMPLATES[mediaType].shotTypes;
  }

  /**
   * Get all available style presets for a media type.
   */
  getStylePresets(mediaType: MediaType): string[] {
    return SHOT_TEMPLATES[mediaType].stylePresets;
  }
}

// ============================================================================
// Internal Engine (Not exported)
// ============================================================================

/**
 * Internal Cinema Engine implementation.
 *
 * This is NOT exported and should NEVER be accessed directly.
 * All access goes through the CinemaAdapter.
 */
const CinemaEngine = {
  /**
   * Translate semantic scene to shots.
   * Creates a comprehensive shot breakdown based on cinematic storytelling principles.
   */
  async translateToShots(
    _context: CinemaContext,
    semanticScene: SemanticSceneOutput,
    mediaType: MediaType,
    options?: { style?: string; targetShotCount?: number }
  ): Promise<TranslationResult> {
    const template = SHOT_TEMPLATES[mediaType];
    const targetCount = options?.targetShotCount || 5;
    const style = options?.style || template.stylePresets[0];

    // Generate shots based on cinematic storytelling principles
    const shots: CinematicShot[] = [];

    // Shot sequence based on scene pacing and emotional beats
    const shotSequence = generateShotSequence(semanticScene, targetCount, template.shotTypes);

    shotSequence.forEach((shotConfig, i) => {
      const cameraMovement = inferCameraMovement(shotConfig.type, semanticScene.pacing);
      const duration = inferShotDuration(shotConfig.type, semanticScene.pacing);

      shots.push({
        id: `shot-${Date.now()}-${i}`,
        sceneId: semanticScene.sceneId,
        order: i + 1,
        shotType: shotConfig.type,
        description: shotConfig.description,
        visualPrompt: buildEnhancedVisualPrompt(semanticScene, shotConfig, style),
        mood: semanticScene.emotionalBeat,
        lighting: inferLighting(semanticScene.emotionalBeat),
        cameraMovement,
        duration,
        notes: shotConfig.notes,
      });
    });

    return {
      success: true,
      shots,
    };
  },

  /**
   * Generate cinematic prompt.
   */
  async generatePrompt(
    shot: Partial<CinematicShot>,
    style?: string
  ): Promise<{ success: boolean; prompt?: string; error?: string }> {
    const prompt = [
      shot.shotType ? `${shot.shotType} shot` : 'cinematic shot',
      shot.description,
      shot.mood ? `mood: ${shot.mood}` : null,
      shot.lighting ? `lighting: ${shot.lighting}` : null,
      style ? `style: ${style}` : null,
      'cinematic, professional, high quality',
    ].filter(Boolean).join(', ');

    return {
      success: true,
      prompt,
    };
  },

  /**
   * Generate visual preview.
   */
  async generatePreview(
    _context: CinemaContext,
    _shotId: string
  ): Promise<VisualPreviewResult> {
    // TODO: Integrate with image generation API
    return {
      success: true,
      creditsUsed: 1,
    };
  },

  /**
   * Generate mood board.
   */
  async generateMoodBoard(
    _context: CinemaContext,
    _themeOrSceneId: string,
    _imageCount: number
  ): Promise<MoodBoardResult> {
    // TODO: Integrate with image generation API
    return {
      success: true,
      images: [],
      creditsUsed: 0,
    };
  },

  /**
   * Generate pitch deck.
   * Creates a comprehensive pitch deck document with project overview,
   * characters, visual style, and key scenes.
   */
  async generatePitchDeck(
    context: CinemaContext
  ): Promise<{ success: boolean; deckUrl?: string; deckContent?: string; error?: string }> {
    try {
      // Get project data
      const project = await dbGetProjectById(context.projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      // Get chapters and lore for additional context
      const chapters = await dbGetProjectChapters(context.projectId);
      const lore = await dbGetProjectLore(context.projectId);

      // Generate pitch deck content
      const deckContent = generatePitchDeckContent(project, chapters, lore);

      return {
        success: true,
        deckContent,
      };
    } catch (error) {
      console.error('[CinemaEngine] Pitch deck generation error:', error);
      return {
        success: false,
        error: 'Failed to generate pitch deck',
      };
    }
  },

  /**
   * Generate production bible.
   * Creates a comprehensive production bible with all project details,
   * character profiles, world-building, and visual references.
   */
  async generateProductionBible(
    context: CinemaContext
  ): Promise<{ success: boolean; bibleUrl?: string; bibleContent?: string; error?: string }> {
    try {
      // Get project data
      const project = await dbGetProjectById(context.projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      // Get chapters with scenes
      const chapters = await dbGetProjectChapters(context.projectId);
      const chaptersWithScenes = await Promise.all(
        chapters.map(async (chapter) => {
          const scenes = await dbGetChapterScenes(chapter.id);
          return { ...chapter, scenes };
        })
      );

      // Get all lore entries by type
      const characterLore = await dbGetProjectLore(context.projectId, 'character');
      const locationLore = await dbGetProjectLore(context.projectId, 'location');
      const eventLore = await dbGetProjectLore(context.projectId, 'event');
      const systemLore = await dbGetProjectLore(context.projectId, 'system');

      // Generate production bible content
      const bibleContent = generateProductionBibleContent(
        project,
        chaptersWithScenes,
        {
          characters: [...(project.characters || [])],
          characterLore,
          locationLore,
          eventLore,
          systemLore,
        }
      );

      return {
        success: true,
        bibleContent,
      };
    } catch (error) {
      console.error('[CinemaEngine] Production bible generation error:', error);
      return {
        success: false,
        error: 'Failed to generate production bible',
      };
    }
  },

  /**
   * Generate video for a shot sequence.
   * Uses Replicate's video models (Stable Video Diffusion or Zeroscope).
   * Cost: 10-25 credits depending on quality tier.
   */
  async generateVideo(
    context: CinemaContext,
    sequenceId: string,
    options?: {
      prompt?: string;
      imageUrl?: string;
      quality?: 'standard' | 'professional' | 'premium';
    }
  ): Promise<{ success: boolean; videoUrl?: string; error?: string; creditsUsed: number; predictionId?: string }> {
    if (!isVideoGenerationConfigured()) {
      return {
        success: false,
        error: 'Video generation is not configured. Please set REPLICATE_API_TOKEN.',
        creditsUsed: 0,
      };
    }

    const quality = options?.quality || 'standard';
    const creditsUsed = getVideoCreditCost(quality);

    // Generate video using the media generation service
    const result = await generateVideoMedia({
      prompt: options?.prompt || `Cinematic sequence ${sequenceId}`,
      imageUrl: options?.imageUrl,
      duration: quality === 'premium' ? 'long' : 'short',
      aspectRatio: '16:9',
      projectId: context.projectId,
      sceneId: sequenceId,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        creditsUsed: 0,
      };
    }

    return {
      success: true,
      videoUrl: result.videoUrl,
      predictionId: result.predictionId,
      creditsUsed,
    };
  },

  /**
   * Generate music for a scene.
   * Uses Replicate MusicGen (cheapest option at ~$0.03-0.05/generation).
   * Cost: 5-10 credits depending on quality tier.
   */
  async generateMusic(
    context: CinemaContext,
    mood: string,
    duration: number,
    options?: {
      genre?: string;
      tempo?: string;
      quality?: 'standard' | 'professional' | 'premium';
    }
  ): Promise<{ success: boolean; audioUrl?: string; error?: string; creditsUsed: number; predictionId?: string }> {
    if (!isMusicGenerationConfigured()) {
      return {
        success: false,
        error: 'Music generation is not configured. Please set REPLICATE_API_TOKEN.',
        creditsUsed: 0,
      };
    }

    const quality = options?.quality || 'standard';
    const creditsUsed = getMusicCreditCost(quality);

    // Build a cinematic music prompt
    const prompt = `Cinematic ${mood} background music, film score, orchestral`;

    const result = await generateMusicMedia({
      prompt,
      duration: Math.min(30, Math.max(5, duration)),
      genre: options?.genre || 'cinematic',
      mood,
      tempo: options?.tempo,
      projectId: context.projectId,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        creditsUsed: 0,
      };
    }

    return {
      success: true,
      audioUrl: result.audioUrl,
      predictionId: result.predictionId,
      creditsUsed,
    };
  },

  /**
   * Generate voiceover for dialogue or narration.
   * Uses OpenAI TTS (cheapest quality option at $0.015/1K chars).
   * Cost: 2 credits per 1000 characters.
   */
  async generateVoiceover(
    context: CinemaContext,
    text: string,
    voiceId?: string,
    options?: {
      model?: 'tts-1' | 'tts-1-hd';
      speed?: number;
    }
  ): Promise<{ success: boolean; audioUrl?: string; duration?: number; error?: string; creditsUsed: number }> {
    if (!isVoiceoverGenerationConfigured()) {
      return {
        success: false,
        error: 'Voiceover generation is not configured. Please set OPENAI_API_KEY.',
        creditsUsed: 0,
      };
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      return {
        success: false,
        error: 'Text is required for voiceover generation',
        creditsUsed: 0,
      };
    }

    const creditsUsed = getVoiceoverCreditCost(trimmedText.length);

    // Map voiceId to OpenAI voice
    const voice = (voiceId as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer') || 'nova';

    const result = await generateVoiceoverMedia({
      text: trimmedText,
      voice,
      model: options?.model || 'tts-1',
      speed: options?.speed || 1.0,
      projectId: context.projectId,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        creditsUsed: 0,
      };
    }

    return {
      success: true,
      audioUrl: result.audioUrl,
      duration: result.duration,
      creditsUsed,
    };
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function buildVisualPrompt(scene: SemanticSceneOutput, shotType: string, style: string): string {
  const elements = [
    `${shotType} shot`,
    scene.purpose,
    ...scene.visualElements.slice(0, 3),
    `mood: ${scene.emotionalBeat}`,
    `style: ${style}`,
    'cinematic, professional quality',
  ];

  return elements.filter(Boolean).join(', ');
}

/**
 * Generate a shot sequence based on cinematic storytelling principles.
 */
function generateShotSequence(
  scene: SemanticSceneOutput,
  targetCount: number,
  availableShotTypes: string[]
): Array<{ type: string; description: string; notes?: string }> {
  const sequence: Array<{ type: string; description: string; notes?: string }> = [];

  // Cinematic shot flow based on pacing
  const pacingPatterns: Record<string, string[]> = {
    slow: ['wide', 'medium', 'close-up', 'insert', 'medium'],
    medium: ['establishing', 'medium', 'over-the-shoulder', 'close-up', 'two-shot'],
    fast: ['close-up', 'medium', 'tracking', 'close-up', 'wide'],
  };

  const pattern = pacingPatterns[scene.pacing] || pacingPatterns.medium;

  for (let i = 0; i < targetCount; i++) {
    const shotType = pattern[i % pattern.length];
    const validShotType = availableShotTypes.includes(shotType) ? shotType : availableShotTypes[0];

    sequence.push({
      type: validShotType,
      description: generateShotDescription(validShotType, scene, i),
      notes: generateShotNotes(validShotType, scene, i, targetCount),
    });
  }

  return sequence;
}

/**
 * Generate a descriptive sentence for a shot based on type and scene context.
 */
function generateShotDescription(
  shotType: string,
  scene: SemanticSceneOutput,
  index: number
): string {
  const descriptions: Record<string, string[]> = {
    'establishing': [
      'Wide establishing shot revealing the location and setting the scene',
      'Sweeping vista introducing the environment and atmosphere',
    ],
    'wide': [
      'Wide shot capturing the full scope of the action',
      'Master shot showing all characters in relation to the space',
    ],
    'medium': [
      'Medium shot framing the subject from waist up',
      'Standard coverage shot capturing dialogue and reactions',
    ],
    'close-up': [
      'Close-up capturing emotional nuance and expression',
      'Intimate shot focusing on character reaction',
    ],
    'extreme-close-up': [
      'Extreme close-up on significant detail or emotion',
      'Macro shot emphasizing critical visual element',
    ],
    'over-the-shoulder': [
      'Over-the-shoulder shot establishing conversation dynamics',
      'Reverse angle showing listener reaction',
    ],
    'two-shot': [
      'Two-shot framing both characters in conversation',
      'Dual subject composition showing relationship',
    ],
    'point-of-view': [
      'Point-of-view shot showing what the character sees',
      'Subjective camera capturing character perspective',
    ],
    'insert': [
      'Insert shot highlighting important prop or detail',
      'Cutaway to significant object or action',
    ],
    'tracking': [
      'Tracking shot following subject movement',
      'Dynamic camera move paralleling action',
    ],
    'dolly': [
      'Dolly shot moving toward or away from subject',
      'Push-in/pull-out creating emotional emphasis',
    ],
    'crane': [
      'Crane shot rising or descending for dramatic effect',
      'Elevated camera move revealing spatial relationships',
    ],
    'aerial': [
      'Aerial shot providing birds-eye perspective',
      'Drone shot establishing geographic context',
    ],
    'handheld': [
      'Handheld shot adding urgency and immediacy',
      'Documentary-style coverage for authenticity',
    ],
  };

  const typeDescriptions = descriptions[shotType] || ['Cinematic shot capturing the scene'];
  const description = typeDescriptions[index % typeDescriptions.length];

  // Add scene-specific context
  if (scene.visualElements.length > 0) {
    const element = scene.visualElements[index % scene.visualElements.length];
    return `${description}. Focus on ${element}`;
  }

  return description;
}

/**
 * Generate production notes for a shot.
 */
function generateShotNotes(
  shotType: string,
  scene: SemanticSceneOutput,
  index: number,
  totalShots: number
): string {
  const notes: string[] = [];

  // Position-based notes
  if (index === 0) {
    notes.push('Opening shot - establish location and tone');
  } else if (index === totalShots - 1) {
    notes.push('Final shot - provide transition or closure');
  }

  // Emotional beat notes
  if (scene.emotionalBeat) {
    notes.push(`Convey ${scene.emotionalBeat} mood`);
  }

  // Shot-type specific notes
  const typeNotes: Record<string, string> = {
    'establishing': 'Allow 3-4 seconds for audience orientation',
    'close-up': 'Ensure proper focus and eye light',
    'tracking': 'Coordinate movement with grip department',
    'handheld': 'Maintain intentional, controlled movement',
    'crane': 'Pre-plan start and end positions',
  };

  if (typeNotes[shotType]) {
    notes.push(typeNotes[shotType]);
  }

  return notes.join('. ');
}

/**
 * Build an enhanced visual prompt for image generation.
 */
function buildEnhancedVisualPrompt(
  scene: SemanticSceneOutput,
  shotConfig: { type: string; description: string },
  style: string
): string {
  const elements = [
    `${shotConfig.type} shot`,
    shotConfig.description,
    ...scene.visualElements.slice(0, 3),
    `${scene.emotionalBeat} mood`,
    `${style} style`,
    'cinematic composition',
    'professional cinematography',
    'high production value',
    '8K resolution',
  ];

  return elements.filter(Boolean).join(', ');
}

/**
 * Infer camera movement based on shot type and pacing.
 */
function inferCameraMovement(shotType: string, pacing: 'slow' | 'medium' | 'fast'): string {
  const movements: Record<string, Record<string, string>> = {
    slow: {
      'establishing': 'slow pan',
      'wide': 'static',
      'medium': 'subtle dolly',
      'close-up': 'static with breathing room',
      'tracking': 'slow, steady track',
    },
    medium: {
      'establishing': 'slow crane up',
      'wide': 'slight push',
      'medium': 'follow action',
      'close-up': 'subtle push',
      'tracking': 'smooth steadicam',
    },
    fast: {
      'establishing': 'quick whip pan',
      'wide': 'dynamic crane',
      'medium': 'reactive handheld',
      'close-up': 'quick rack focus',
      'tracking': 'aggressive chase',
    },
  };

  return movements[pacing]?.[shotType] || 'static';
}

/**
 * Infer shot duration based on type and pacing.
 */
function inferShotDuration(shotType: string, pacing: 'slow' | 'medium' | 'fast'): number {
  const baseDurations: Record<string, number> = {
    'establishing': 5,
    'wide': 4,
    'medium': 3,
    'close-up': 2,
    'extreme-close-up': 1.5,
    'over-the-shoulder': 2.5,
    'two-shot': 3,
    'insert': 1.5,
    'tracking': 4,
  };

  const pacingMultipliers: Record<string, number> = {
    slow: 1.5,
    medium: 1.0,
    fast: 0.7,
  };

  const baseDuration = baseDurations[shotType] || 3;
  const multiplier = pacingMultipliers[pacing] || 1.0;

  return Math.round(baseDuration * multiplier * 10) / 10;
}

function inferLighting(mood: string): string {
  const moodLightingMap: Record<string, string> = {
    'tense': 'high contrast, dramatic shadows',
    'romantic': 'soft, warm golden hour',
    'mysterious': 'low key, shadows',
    'joyful': 'bright, natural daylight',
    'melancholic': 'overcast, muted',
    'suspenseful': 'chiaroscuro, dramatic',
    'peaceful': 'soft, diffused',
    'angry': 'harsh, red-tinted',
  };

  return moodLightingMap[mood.toLowerCase()] || 'natural lighting';
}

// ============================================================================
// Document Generation Functions
// ============================================================================

/**
 * Generate pitch deck content in Markdown format.
 * A pitch deck is a brief presentation for pitching a project to studios/investors.
 */
function generatePitchDeckContent(
  project: Project,
  chapters: Chapter[],
  lore: LoreEntry[]
): string {
  const lines: string[] = [];
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Cover slide
  lines.push('---');
  lines.push('# PITCH DECK');
  lines.push('---');
  lines.push('');
  lines.push(`# ${project.name.toUpperCase()}`);
  lines.push('');
  if (project.genre) {
    lines.push(`**Genre:** ${project.genre}`);
  }
  if (project.workType) {
    lines.push(`**Format:** ${formatWorkType(project.workType)}`);
  }
  lines.push(`**Date:** ${date}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Logline
  lines.push('## LOGLINE');
  lines.push('');
  if (project.logline) {
    lines.push(`> ${project.logline}`);
  } else if (project.description) {
    // Generate logline from description
    const logline = project.description.split('.')[0] + '.';
    lines.push(`> ${logline}`);
  } else {
    lines.push('> [Logline to be added]');
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Synopsis
  lines.push('## SYNOPSIS');
  lines.push('');
  if (project.synopsis) {
    lines.push(project.synopsis);
  } else if (project.description) {
    lines.push(project.description);
  } else {
    lines.push('[Synopsis to be added]');
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Key Characters
  if (project.characters && project.characters.length > 0) {
    lines.push('## KEY CHARACTERS');
    lines.push('');
    const mainCharacters = project.characters.slice(0, 5); // Top 5 characters
    mainCharacters.forEach((char) => {
      lines.push(`### ${char.name}`);
      if (char.description) {
        lines.push(char.description);
      }
      if (char.traits && char.traits.length > 0) {
        lines.push(`**Traits:** ${char.traits.join(', ')}`);
      }
      if (char.imageUrl) {
        lines.push(`![${char.name}](${char.imageUrl})`);
      }
      lines.push('');
    });
    lines.push('---');
    lines.push('');
  }

  // World/Setting (from location lore)
  const locations = lore.filter(l => l.type === 'location');
  if (locations.length > 0) {
    lines.push('## THE WORLD');
    lines.push('');
    locations.slice(0, 3).forEach((loc) => {
      lines.push(`### ${loc.name}`);
      lines.push(loc.summary);
      if (loc.imageUrl) {
        lines.push(`![${loc.name}](${loc.imageUrl})`);
      }
      lines.push('');
    });
    lines.push('---');
    lines.push('');
  }

  // Visual Style
  lines.push('## VISUAL STYLE');
  lines.push('');
  lines.push('**Tone:** ' + (project.genre ? inferToneFromGenre(project.genre) : 'Cinematic'));
  lines.push('');
  lines.push('**Visual Influences:**');
  lines.push(inferVisualInfluences(project.genre || 'drama'));
  lines.push('');
  lines.push('---');
  lines.push('');

  // Story Structure
  if (chapters.length > 0) {
    lines.push('## STORY STRUCTURE');
    lines.push('');
    lines.push(`**Total Acts/Chapters:** ${chapters.length}`);
    if (project.totalWordCount) {
      lines.push(`**Estimated Runtime:** ${estimateRuntime(project.totalWordCount)}`);
    }
    lines.push('');
    lines.push('### Act Breakdown');
    lines.push('');
    chapters.slice(0, 5).forEach((chapter, idx) => {
      const actLabel = chapters.length <= 3 ? `Act ${idx + 1}` : `Chapter ${chapter.number}`;
      lines.push(`**${actLabel}: ${chapter.title}**`);
      if (chapter.summary) {
        lines.push(chapter.summary);
      }
      lines.push('');
    });
    if (chapters.length > 5) {
      lines.push(`*...and ${chapters.length - 5} more chapters*`);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  // Target Audience
  lines.push('## TARGET AUDIENCE');
  lines.push('');
  lines.push(inferTargetAudience(project.genre || 'drama'));
  lines.push('');
  lines.push('---');
  lines.push('');

  // Comparable Titles
  lines.push('## COMPARABLE TITLES');
  lines.push('');
  lines.push(inferComparables(project.genre || 'drama'));
  lines.push('');
  lines.push('---');
  lines.push('');

  // Contact
  lines.push('## CONTACT');
  lines.push('');
  lines.push('**Created with Halcyon Cinema**');
  lines.push('');
  lines.push('[Contact information to be added]');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate production bible content in Markdown format.
 * A production bible is a comprehensive reference document for film/TV production.
 */
function generateProductionBibleContent(
  project: Project,
  chapters: Array<Chapter & { scenes: ChapterScene[] }>,
  loreData: {
    characters: Character[];
    characterLore: LoreEntry[];
    locationLore: LoreEntry[];
    eventLore: LoreEntry[];
    systemLore: LoreEntry[];
  }
): string {
  const lines: string[] = [];
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Title Page
  lines.push('# PRODUCTION BIBLE');
  lines.push('');
  lines.push(`# ${project.name.toUpperCase()}`);
  lines.push('');
  lines.push(`**Version:** 1.0`);
  lines.push(`**Date:** ${date}`);
  if (project.genre) {
    lines.push(`**Genre:** ${project.genre}`);
  }
  if (project.workType) {
    lines.push(`**Format:** ${formatWorkType(project.workType)}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Table of Contents
  lines.push('## TABLE OF CONTENTS');
  lines.push('');
  lines.push('1. [Project Overview](#project-overview)');
  lines.push('2. [Story Synopsis](#story-synopsis)');
  lines.push('3. [Characters](#characters)');
  lines.push('4. [Locations](#locations)');
  lines.push('5. [World Building](#world-building)');
  lines.push('6. [Timeline & Events](#timeline--events)');
  lines.push('7. [Visual Style Guide](#visual-style-guide)');
  lines.push('8. [Episode/Chapter Breakdown](#episodechapter-breakdown)');
  lines.push('9. [Scene Inventory](#scene-inventory)');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Project Overview
  lines.push('## PROJECT OVERVIEW');
  lines.push('');
  lines.push(`**Title:** ${project.name}`);
  if (project.logline) {
    lines.push('');
    lines.push('**Logline:**');
    lines.push(`> ${project.logline}`);
  }
  lines.push('');
  if (project.description) {
    lines.push('**Description:**');
    lines.push(project.description);
    lines.push('');
  }
  lines.push('**Production Stats:**');
  lines.push(`- Total Chapters: ${chapters.length}`);
  const totalScenes = chapters.reduce((acc, ch) => acc + ch.scenes.length, 0);
  lines.push(`- Total Scenes: ${totalScenes}`);
  if (project.totalWordCount) {
    lines.push(`- Word Count: ${project.totalWordCount.toLocaleString()}`);
    lines.push(`- Estimated Runtime: ${estimateRuntime(project.totalWordCount)}`);
  }
  lines.push(`- Characters: ${loreData.characters.length + loreData.characterLore.length}`);
  lines.push(`- Locations: ${loreData.locationLore.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Story Synopsis
  lines.push('## STORY SYNOPSIS');
  lines.push('');
  if (project.synopsis) {
    lines.push(project.synopsis);
  } else if (project.description) {
    lines.push(project.description);
  } else {
    lines.push('[Synopsis to be added]');
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Characters
  lines.push('## CHARACTERS');
  lines.push('');

  // Main characters from project
  if (loreData.characters.length > 0) {
    lines.push('### Main Characters');
    lines.push('');
    loreData.characters.forEach((char) => {
      lines.push(`#### ${char.name}`);
      lines.push('');
      if (char.imageUrl) {
        lines.push(`![${char.name}](${char.imageUrl})`);
        lines.push('');
      }
      if (char.description) {
        lines.push('**Description:**');
        lines.push(char.description);
        lines.push('');
      }
      if (char.traits && char.traits.length > 0) {
        lines.push(`**Character Traits:** ${char.traits.join(', ')}`);
        lines.push('');
      }
      if (char.appearances && char.appearances.length > 0) {
        lines.push(`**Appearances:** ${char.appearances.length} scenes`);
        lines.push('');
      }
    });
  }

  // Character lore entries
  if (loreData.characterLore.length > 0) {
    lines.push('### Character Profiles');
    lines.push('');
    loreData.characterLore.forEach((char) => {
      lines.push(`#### ${char.name}`);
      lines.push('');
      if (char.imageUrl) {
        lines.push(`![${char.name}](${char.imageUrl})`);
        lines.push('');
      }
      lines.push('**Summary:**');
      lines.push(char.summary);
      lines.push('');
      if (char.description) {
        lines.push('**Full Profile:**');
        lines.push(char.description);
        lines.push('');
      }
      if (char.tags && char.tags.length > 0) {
        lines.push(`**Tags:** ${char.tags.join(', ')}`);
        lines.push('');
      }
    });
  }
  lines.push('---');
  lines.push('');

  // Locations
  lines.push('## LOCATIONS');
  lines.push('');
  if (loreData.locationLore.length > 0) {
    loreData.locationLore.forEach((loc) => {
      lines.push(`### ${loc.name}`);
      lines.push('');
      if (loc.imageUrl) {
        lines.push(`![${loc.name}](${loc.imageUrl})`);
        lines.push('');
      }
      lines.push('**Description:**');
      lines.push(loc.summary);
      lines.push('');
      if (loc.description) {
        lines.push('**Production Notes:**');
        lines.push(loc.description);
        lines.push('');
      }
      if (loc.tags && loc.tags.length > 0) {
        lines.push(`**Tags:** ${loc.tags.join(', ')}`);
        lines.push('');
      }
    });
  } else {
    lines.push('[No locations defined yet]');
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  // World Building
  lines.push('## WORLD BUILDING');
  lines.push('');
  if (loreData.systemLore.length > 0) {
    lines.push('### Rules & Systems');
    lines.push('');
    loreData.systemLore.forEach((sys) => {
      lines.push(`#### ${sys.name}`);
      lines.push('');
      lines.push(sys.summary);
      lines.push('');
      if (sys.description) {
        lines.push(sys.description);
        lines.push('');
      }
    });
  } else {
    lines.push('[World building rules to be added]');
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  // Timeline & Events
  lines.push('## TIMELINE & EVENTS');
  lines.push('');
  if (loreData.eventLore.length > 0) {
    lines.push('### Key Events');
    lines.push('');
    loreData.eventLore.forEach((event, idx) => {
      lines.push(`${idx + 1}. **${event.name}**`);
      lines.push(`   ${event.summary}`);
      lines.push('');
    });
  } else {
    lines.push('[Timeline events to be added]');
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  // Visual Style Guide
  lines.push('## VISUAL STYLE GUIDE');
  lines.push('');
  lines.push('### Color Palette');
  lines.push(inferColorPalette(project.genre || 'drama'));
  lines.push('');
  lines.push('### Lighting Style');
  lines.push(inferLightingStyle(project.genre || 'drama'));
  lines.push('');
  lines.push('### Camera Work');
  lines.push(inferCameraStyle(project.genre || 'drama'));
  lines.push('');
  lines.push('### Visual References');
  lines.push(inferVisualInfluences(project.genre || 'drama'));
  lines.push('');
  lines.push('---');
  lines.push('');

  // Episode/Chapter Breakdown
  lines.push('## EPISODE/CHAPTER BREAKDOWN');
  lines.push('');
  chapters.forEach((chapter) => {
    lines.push(`### ${chapter.number}. ${chapter.title}`);
    lines.push('');
    lines.push(`**Status:** ${chapter.status || 'Draft'}`);
    lines.push(`**Word Count:** ${chapter.wordCount?.toLocaleString() || 0}`);
    lines.push(`**Scenes:** ${chapter.scenes.length}`);
    lines.push('');
    if (chapter.summary) {
      lines.push('**Summary:**');
      lines.push(chapter.summary);
      lines.push('');
    }
    if (chapter.notes) {
      lines.push('**Production Notes:**');
      lines.push(chapter.notes);
      lines.push('');
    }
  });
  lines.push('---');
  lines.push('');

  // Scene Inventory
  lines.push('## SCENE INVENTORY');
  lines.push('');
  lines.push('| Chapter | Scene | Title | Characters | Location |');
  lines.push('|---------|-------|-------|------------|----------|');
  chapters.forEach((chapter) => {
    chapter.scenes.forEach((scene, sceneIdx) => {
      const sceneTitle = scene.title || `Scene ${sceneIdx + 1}`;
      const charCount = scene.characterIds?.length || 0;
      const location = scene.locationId || '-';
      lines.push(`| ${chapter.number} | ${sceneIdx + 1} | ${sceneTitle} | ${charCount} | ${location} |`);
    });
  });
  lines.push('');
  lines.push('---');
  lines.push('');

  // Footer
  lines.push('*Generated by Halcyon Cinema*');
  lines.push('');

  return lines.join('\n');
}

// Helper functions for document generation
function formatWorkType(workType: string): string {
  const typeMap: Record<string, string> = {
    'novel': 'Feature Film (Novel Adaptation)',
    'novella': 'Limited Series / Feature',
    'short-story': 'Short Film',
    'manuscript': 'Feature Film',
    'screenplay': 'Feature Film',
    'teleplay': 'Television Series',
    'stage-play': 'Stage Production / Film Adaptation',
    'series': 'Television Series',
  };
  return typeMap[workType] || workType;
}

function inferToneFromGenre(genre: string): string {
  const toneMap: Record<string, string> = {
    'fantasy': 'Epic, Sweeping, Magical',
    'science-fiction': 'Futuristic, Atmospheric, Thought-Provoking',
    'mystery': 'Suspenseful, Moody, Intriguing',
    'thriller': 'Tense, Edge-of-Seat, Gripping',
    'romance': 'Warm, Emotional, Intimate',
    'horror': 'Dark, Atmospheric, Unsettling',
    'drama': 'Emotional, Character-Driven, Authentic',
    'comedy': 'Light, Energetic, Witty',
    'action': 'Dynamic, High-Energy, Visceral',
    'historical': 'Period-Accurate, Epic, Immersive',
  };
  return toneMap[genre.toLowerCase()] || 'Cinematic, Engaging';
}

function inferVisualInfluences(genre: string): string {
  const influences: Record<string, string> = {
    'fantasy': '- Lord of the Rings trilogy\n- Game of Thrones\n- The Witcher\n- Dune (2021)',
    'science-fiction': '- Blade Runner 2049\n- Arrival\n- Interstellar\n- Ex Machina',
    'mystery': '- Knives Out\n- Gone Girl\n- Zodiac\n- The Girl with the Dragon Tattoo',
    'thriller': '- Sicario\n- No Country for Old Men\n- The Silence of the Lambs\n- Se7en',
    'romance': '- La La Land\n- Pride and Prejudice\n- The Notebook\n- Call Me By Your Name',
    'horror': '- Hereditary\n- The Shining\n- Get Out\n- A Quiet Place',
    'drama': '- The Godfather\n- Moonlight\n- Manchester by the Sea\n- Marriage Story',
    'comedy': '- The Grand Budapest Hotel\n- Superbad\n- Bridesmaids\n- The Big Lebowski',
    'action': '- Mad Max: Fury Road\n- John Wick\n- Mission: Impossible - Fallout\n- The Dark Knight',
    'historical': '- Schindler\'s List\n- The King\'s Speech\n- 1917\n- Lincoln',
  };
  return influences[genre.toLowerCase()] || '- To be determined based on project vision';
}

function inferTargetAudience(genre: string): string {
  const audiences: Record<string, string> = {
    'fantasy': '**Primary:** Adults 18-45 who enjoy epic fantasy and world-building\n**Secondary:** Young adults interested in adventure and mythology',
    'science-fiction': '**Primary:** Adults 25-54 interested in speculative fiction\n**Secondary:** Tech-savvy viewers who enjoy thought-provoking narratives',
    'mystery': '**Primary:** Adults 35-65 who enjoy puzzle-solving narratives\n**Secondary:** True crime enthusiasts and thriller fans',
    'thriller': '**Primary:** Adults 25-54 seeking high-tension entertainment\n**Secondary:** Action movie fans who appreciate smart plotting',
    'romance': '**Primary:** Adults 18-49, predominantly female audience\n**Secondary:** Couples seeking date-night entertainment',
    'horror': '**Primary:** Adults 18-34 who enjoy genre entertainment\n**Secondary:** Horror enthusiasts and festival audiences',
    'drama': '**Primary:** Adults 35+ seeking prestige entertainment\n**Secondary:** Awards-season audiences and critics',
    'comedy': '**Primary:** Adults 18-49 seeking entertainment\n**Secondary:** Family audiences for broader comedies',
    'action': '**Primary:** Males 18-45 seeking spectacle entertainment\n**Secondary:** International markets with global appeal',
    'young-adult': '**Primary:** Teens 13-19 and young adults 18-25\n**Secondary:** Parents and crossover adult audiences',
  };
  return audiences[genre.toLowerCase()] || '**Primary:** General audiences seeking quality entertainment\n**Secondary:** Genre enthusiasts';
}

function inferComparables(genre: string): string {
  const comps: Record<string, string> = {
    'fantasy': '- **Game of Thrones** (epic scope, political intrigue)\n- **The Witcher** (dark fantasy, complex characters)\n- **House of the Dragon** (dynasty drama)',
    'science-fiction': '- **Westworld** (philosophical themes)\n- **The Expanse** (hard sci-fi world-building)\n- **Black Mirror** (speculative concepts)',
    'mystery': '- **Only Murders in the Building** (engaging mystery)\n- **Mare of Easttown** (character-driven investigation)\n- **The White Lotus** (ensemble intrigue)',
    'thriller': '- **Yellowjackets** (psychological tension)\n- **The Night Of** (procedural drama)\n- **Mindhunter** (dark subject matter)',
    'romance': '- **Bridgerton** (romantic escapism)\n- **Normal People** (intimate relationships)\n- **The Time Traveler\'s Wife** (unique premise)',
    'horror': '- **The Haunting of Hill House** (elevated horror)\n- **Midnight Mass** (atmospheric dread)\n- **Servant** (psychological horror)',
    'drama': '- **Succession** (family dynamics)\n- **The Crown** (prestige production)\n- **Better Call Saul** (character development)',
    'comedy': '- **Ted Lasso** (heartwarming comedy)\n- **Schitt\'s Creek** (ensemble comedy)\n- **The Bear** (dramedy)',
    'action': '- **Reacher** (action-thriller)\n- **Jack Ryan** (geopolitical action)\n- **The Mandalorian** (adventure)',
  };
  return comps[genre.toLowerCase()] || '- To be determined based on final execution';
}

function estimateRuntime(wordCount: number): string {
  // Film scripts average 1 minute per page, ~250 words per page
  // So roughly 1 minute per 250 words
  const minutes = Math.round(wordCount / 250);
  if (minutes < 60) {
    return `${minutes} minutes (Short Film)`;
  } else if (minutes < 90) {
    return `${minutes} minutes (Short Feature)`;
  } else if (minutes < 120) {
    return `${minutes} minutes (Feature Film)`;
  } else if (minutes < 180) {
    return `${minutes} minutes (Epic Feature)`;
  } else {
    const episodes = Math.ceil(minutes / 45);
    return `~${episodes} episodes (${minutes} minutes total)`;
  }
}

function inferColorPalette(genre: string): string {
  const palettes: Record<string, string> = {
    'fantasy': '- **Primary:** Deep golds, rich purples, forest greens\n- **Accent:** Silver, bronze, crimson\n- **Mood:** Warm and mystical with cooler tones for danger',
    'science-fiction': '- **Primary:** Cool blues, steely grays, neon accents\n- **Accent:** Holographic effects, LED highlights\n- **Mood:** Clinical and futuristic with warm human moments',
    'mystery': '- **Primary:** Muted earth tones, shadowy blacks\n- **Accent:** Single color pops for clues\n- **Mood:** Desaturated with contrast for revelations',
    'thriller': '- **Primary:** High contrast blacks and whites\n- **Accent:** Blood reds, warning oranges\n- **Mood:** Stark and unforgiving',
    'romance': '- **Primary:** Soft pastels, golden hour warmth\n- **Accent:** Rose pinks, sunset oranges\n- **Mood:** Warm and dreamy',
    'horror': '- **Primary:** Sickly greens, deep blacks, decayed browns\n- **Accent:** Arterial reds, ghostly blues\n- **Mood:** Oppressive and unsettling',
    'drama': '- **Primary:** Natural, realistic tones\n- **Accent:** Emotional color coding per character\n- **Mood:** Grounded and authentic',
    'comedy': '- **Primary:** Bright, saturated primaries\n- **Accent:** Pop colors for comic effect\n- **Mood:** Energetic and inviting',
    'action': '- **Primary:** Bold oranges, deep teals\n- **Accent:** Explosive reds and yellows\n- **Mood:** High energy and dynamic',
  };
  return palettes[genre.toLowerCase()] || '- To be defined based on creative direction';
}

function inferLightingStyle(genre: string): string {
  const lighting: Record<string, string> = {
    'fantasy': '- Dramatic key lighting for heroes\n- Practical sources: torches, magic effects\n- Golden hour exteriors\n- Chiaroscuro for villains',
    'science-fiction': '- Hard, clinical lighting for tech spaces\n- Neon rim lights and practicals\n- Motivated source lighting\n- Lens flares for scale',
    'mystery': '- Low key lighting, deep shadows\n- Single source dramatic lighting\n- Silhouettes for suspects\n- Revelation through light changes',
    'thriller': '- Harsh overhead lighting for interrogation\n- Underlit faces for threat\n- Strobe effects for action\n- Natural light for false security',
    'romance': '- Soft, diffused lighting\n- Golden hour preference\n- Candlelight intimacy\n- Backlit for ethereal moments',
    'horror': '- Underlit faces\n- Practical sources only in some scenes\n- Flickering for unease\n- Deep black levels',
    'drama': '- Naturalistic motivated lighting\n- Soft keys for emotion\n- Window light for realism\n- Color temperature for mood',
    'comedy': '- Even, bright lighting\n- High key for most scenes\n- Sitcom-style coverage lighting\n- Natural for grounded comedy',
    'action': '- Dynamic, moving light sources\n- High contrast for intensity\n- Practical explosions and effects\n- Motivated action lighting',
  };
  return lighting[genre.toLowerCase()] || '- To be defined based on creative direction';
}

function inferCameraStyle(genre: string): string {
  const camera: Record<string, string> = {
    'fantasy': '- Sweeping crane shots for scale\n- Steadicam for following heroes\n- Wide establishing shots\n- Close-ups for emotional beats',
    'science-fiction': '- Slow, deliberate movements\n- Symmetrical framing\n- Scale shots for technology\n- POV for immersion',
    'mystery': '- Static shots building tension\n- Slow zooms for revelation\n- Dutch angles for unease\n- Close-ups on clues',
    'thriller': '- Handheld for tension\n- Quick cuts during action\n- Claustrophobic framing\n- Ticking clock montages',
    'romance': '- Two-shots for connection\n- Slow push-ins for intimacy\n- Soft focus backgrounds\n- Match cuts between lovers',
    'horror': '- Long static shots with dread\n- Slow reveals\n- Found footage elements possible\n- Jump cut scares',
    'drama': '- Coverage for performance\n- Long takes for emotion\n- Close-ups for reaction\n- Motivated camera movement',
    'comedy': '- Wide shots for physical comedy\n- Quick pans for jokes\n- Reaction shot coverage\n- Static for dialogue',
    'action': '- Dynamic movement throughout\n- Tracking shots for chases\n- Aerial for scale\n- Slow motion for impact',
  };
  return camera[genre.toLowerCase()] || '- To be defined based on creative direction';
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a Cinema adapter for a user context.
 */
export function createCinemaAdapter(context: CinemaContext): CinemaAdapter {
  return new CinemaAdapter(context);
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  CinematicShot,
  ShotTemplate,
  MediaType,
  SemanticSceneOutput,
};

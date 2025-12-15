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
 * - Cinema NEVER imports StoryForge internals
 * - Cinema only accesses StoryForge through the public adapter
 * - Scene semantic data is obtained via StoryForgeAdapter.extractSemanticScene()
 *
 * IMPORTANT: Cinema is an OPTIONAL escalation. Users can use literary works
 * mode or StoryForge mode indefinitely without ever touching Cinema features.
 */

import { SubscriptionTier, hasFeatureAccess, canUseCinema, ProjectMode } from '@/config/feature-flags';
import type {
  SemanticSceneOutput,
  CinematicShot,
  ShotTemplate,
  MediaType,
} from '@/types/literary';

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
   * This takes semantic output (obtained via StoryForgeAdapter.extractSemanticScene)
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
   */
  async generateVideo(sequenceId: string): Promise<{
    success: boolean;
    videoUrl?: string;
    error?: string;
    creditsUsed: number;
  }> {
    const error = this.validateAccess('videoGeneration');
    if (error) {
      return {
        success: false,
        error: error.message,
        creditsUsed: 0,
      };
    }

    return CinemaEngine.generateVideo(this.context, sequenceId);
  }

  /**
   * Generate music for a scene or project.
   */
  async generateMusic(mood: string, duration: number): Promise<{
    success: boolean;
    audioUrl?: string;
    error?: string;
    creditsUsed: number;
  }> {
    const error = this.validateAccess('musicGeneration');
    if (error) {
      return {
        success: false,
        error: error.message,
        creditsUsed: 0,
      };
    }

    return CinemaEngine.generateMusic(this.context, mood, duration);
  }

  /**
   * Generate voiceover for text.
   */
  async generateVoiceover(text: string, voiceId?: string): Promise<{
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

    return CinemaEngine.generateVoiceover(this.context, text, voiceId);
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
   */
  async translateToShots(
    context: CinemaContext,
    semanticScene: SemanticSceneOutput,
    mediaType: MediaType,
    options?: { style?: string; targetShotCount?: number }
  ): Promise<TranslationResult> {
    const template = SHOT_TEMPLATES[mediaType];
    const targetCount = options?.targetShotCount || 5;
    const style = options?.style || template.stylePresets[0];

    // Generate shots based on semantic content
    const shots: CinematicShot[] = [];
    const baseShotTypes = ['establishing', 'medium', 'close-up'];

    for (let i = 0; i < Math.min(targetCount, baseShotTypes.length); i++) {
      const shotType = baseShotTypes[i] || template.shotTypes[0];
      shots.push({
        id: `shot-${Date.now()}-${i}`,
        sceneId: semanticScene.sceneId,
        order: i + 1,
        shotType,
        description: `${shotType} shot of the scene`,
        visualPrompt: buildVisualPrompt(semanticScene, shotType, style),
        mood: semanticScene.emotionalBeat,
        lighting: inferLighting(semanticScene.emotionalBeat),
      });
    }

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
   */
  async generatePitchDeck(
    _context: CinemaContext
  ): Promise<{ success: boolean; deckUrl?: string; error?: string }> {
    // TODO: Implement pitch deck generation
    return {
      success: true,
    };
  },

  /**
   * Generate production bible.
   */
  async generateProductionBible(
    _context: CinemaContext
  ): Promise<{ success: boolean; bibleUrl?: string; error?: string }> {
    // TODO: Implement production bible generation
    return {
      success: true,
    };
  },

  /**
   * Generate video.
   */
  async generateVideo(
    _context: CinemaContext,
    _sequenceId: string
  ): Promise<{ success: boolean; videoUrl?: string; error?: string; creditsUsed: number }> {
    // TODO: Integrate with video generation API
    return {
      success: true,
      creditsUsed: 10,
    };
  },

  /**
   * Generate music.
   */
  async generateMusic(
    _context: CinemaContext,
    _mood: string,
    _duration: number
  ): Promise<{ success: boolean; audioUrl?: string; error?: string; creditsUsed: number }> {
    // TODO: Integrate with music generation API
    return {
      success: true,
      creditsUsed: 5,
    };
  },

  /**
   * Generate voiceover.
   */
  async generateVoiceover(
    _context: CinemaContext,
    _text: string,
    _voiceId?: string
  ): Promise<{ success: boolean; audioUrl?: string; duration?: number; error?: string; creditsUsed: number }> {
    // TODO: Integrate with TTS API
    return {
      success: true,
      creditsUsed: 2,
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

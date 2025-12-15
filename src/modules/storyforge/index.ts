/**
 * StoryForge Module
 *
 * This is the SINGLE PUBLIC ADAPTER for the StoryForge narrative engine.
 * All external access to StoryForge functionality MUST go through this module.
 *
 * ARCHITECTURE CONSTRAINTS:
 * - StoryForge lives at: /src/modules/storyforge
 * - Cinema lives at: /src/services/cinema
 * - Cinema NEVER imports StoryForge internals
 * - Canon is the single source of truth
 * - Projects own everything
 * - Users own projects
 *
 * IMPORTANT: StoryForge is OPTIONAL. Users can write novels, manuscripts,
 * and other literary works indefinitely WITHOUT ever touching StoryForge.
 * StoryForge is an optional escalation, never a requirement.
 */

import { ProjectMode, SubscriptionTier, hasFeatureAccess, canUseStoryForge } from '@/config/feature-flags';
import type {
  Chapter,
  ChapterScene,
  CanonEntry,
  CanonVault,
  CanonValidationError,
  CanonConflictResolution,
  CanonResolutionAction,
  StoryForgeGenerationRequest,
  StoryForgeGenerationResult,
  SemanticSceneOutput,
} from '@/types/literary';

// ============================================================================
// Types
// ============================================================================

export interface StoryForgeContext {
  userId: string;
  projectId: string;
  tier: SubscriptionTier;
  mode: ProjectMode;
}

export interface StoryForgeError {
  code: 'FEATURE_DISABLED' | 'INSUFFICIENT_TIER' | 'INVALID_MODE' | 'GENERATION_ERROR' | 'CANON_CONFLICT';
  message: string;
  details?: unknown;
}

// ============================================================================
// Feature Access Checks
// ============================================================================

/**
 * Check if StoryForge features are available for the user.
 */
export function isStoryForgeAvailable(tier: SubscriptionTier): boolean {
  return canUseStoryForge(tier);
}

/**
 * Check if a specific StoryForge feature is available.
 */
export function isFeatureAvailable(tier: SubscriptionTier, feature: keyof typeof featurePathMap): boolean {
  const path = featurePathMap[feature];
  return hasFeatureAccess(tier, path);
}

const featurePathMap = {
  narrativeGeneration: 'storyforge.narrativeGeneration',
  chapterExpansion: 'storyforge.chapterExpansion',
  sceneExpansion: 'storyforge.sceneExpansion',
  rewriteCondenseContinue: 'storyforge.rewriteCondenseContinue',
  longFormMemory: 'storyforge.longFormMemory',
  canonValidation: 'storyforge.canonValidation',
  canonConflictResolution: 'storyforge.canonConflictResolution',
  aiAuthorControls: 'storyforge.aiAuthorControls',
} as const;

// ============================================================================
// StoryForge Engine Adapter
// ============================================================================

/**
 * StoryForge Engine Adapter
 *
 * This class provides the public API for all StoryForge functionality.
 * It handles feature gating, mode validation, and delegates to internal
 * engine components.
 */
export class StoryForgeAdapter {
  private context: StoryForgeContext;

  constructor(context: StoryForgeContext) {
    this.context = context;
  }

  /**
   * Check if StoryForge is available for the current context.
   */
  isAvailable(): boolean {
    return isStoryForgeAvailable(this.context.tier);
  }

  /**
   * Validate that the user can use StoryForge features.
   */
  private validateAccess(feature: keyof typeof featurePathMap): StoryForgeError | null {
    if (!this.isAvailable()) {
      return {
        code: 'INSUFFICIENT_TIER',
        message: 'StoryForge features require a Pro or Enterprise subscription',
      };
    }

    if (!isFeatureAvailable(this.context.tier, feature)) {
      return {
        code: 'FEATURE_DISABLED',
        message: `Feature '${feature}' is not available for your subscription tier`,
      };
    }

    return null;
  }

  // ==========================================================================
  // Narrative Generation
  // ==========================================================================

  /**
   * Generate narrative content using AI.
   *
   * This is the core generation function that powers:
   * - Chapter generation
   * - Scene expansion
   * - Rewrite/condense/continue operations
   */
  async generate(request: StoryForgeGenerationRequest): Promise<StoryForgeGenerationResult> {
    const error = this.validateAccess('narrativeGeneration');
    if (error) {
      return {
        success: false,
        error: error.message,
        creditsUsed: 0,
      };
    }

    // Delegate to internal engine
    return StoryForgeEngine.generate(this.context, request);
  }

  /**
   * Expand a chapter with AI assistance.
   */
  async expandChapter(chapterId: string, prompt?: string): Promise<StoryForgeGenerationResult> {
    const error = this.validateAccess('chapterExpansion');
    if (error) {
      return {
        success: false,
        error: error.message,
        creditsUsed: 0,
      };
    }

    return this.generate({
      projectId: this.context.projectId,
      action: 'expand',
      targetType: 'chapter',
      targetId: chapterId,
      prompt,
      context: {
        includeCanon: true,
        includeCharacters: true,
        includePreviousContent: true,
      },
    });
  }

  /**
   * Expand a scene with AI assistance.
   */
  async expandScene(sceneId: string, prompt?: string): Promise<StoryForgeGenerationResult> {
    const error = this.validateAccess('sceneExpansion');
    if (error) {
      return {
        success: false,
        error: error.message,
        creditsUsed: 0,
      };
    }

    return this.generate({
      projectId: this.context.projectId,
      action: 'expand',
      targetType: 'scene',
      targetId: sceneId,
      prompt,
      context: {
        includeCanon: true,
        includeCharacters: true,
        includePreviousContent: true,
      },
    });
  }

  /**
   * Rewrite content with AI assistance.
   */
  async rewrite(targetType: 'chapter' | 'scene' | 'paragraph', targetId: string, prompt?: string): Promise<StoryForgeGenerationResult> {
    const error = this.validateAccess('rewriteCondenseContinue');
    if (error) {
      return {
        success: false,
        error: error.message,
        creditsUsed: 0,
      };
    }

    return this.generate({
      projectId: this.context.projectId,
      action: 'rewrite',
      targetType,
      targetId,
      prompt,
      context: {
        includeCanon: true,
        includeCharacters: true,
        includePreviousContent: false,
      },
    });
  }

  /**
   * Condense content with AI assistance.
   */
  async condense(targetType: 'chapter' | 'scene' | 'paragraph', targetId: string): Promise<StoryForgeGenerationResult> {
    const error = this.validateAccess('rewriteCondenseContinue');
    if (error) {
      return {
        success: false,
        error: error.message,
        creditsUsed: 0,
      };
    }

    return this.generate({
      projectId: this.context.projectId,
      action: 'condense',
      targetType,
      targetId,
      context: {
        includeCanon: true,
        includeCharacters: false,
        includePreviousContent: false,
      },
    });
  }

  /**
   * Continue content with AI assistance.
   */
  async continue(targetType: 'chapter' | 'scene', targetId: string, prompt?: string): Promise<StoryForgeGenerationResult> {
    const error = this.validateAccess('rewriteCondenseContinue');
    if (error) {
      return {
        success: false,
        error: error.message,
        creditsUsed: 0,
      };
    }

    return this.generate({
      projectId: this.context.projectId,
      action: 'continue',
      targetType,
      targetId,
      prompt,
      context: {
        includeCanon: true,
        includeCharacters: true,
        includePreviousContent: true,
      },
    });
  }

  // ==========================================================================
  // Canon Validation
  // ==========================================================================

  /**
   * Validate content against the canon vault.
   */
  async validateCanon(content: string, chapterId?: string): Promise<{
    valid: boolean;
    errors: CanonValidationError[];
  }> {
    const error = this.validateAccess('canonValidation');
    if (error) {
      return {
        valid: true, // Default to valid if feature not available
        errors: [],
      };
    }

    return StoryForgeEngine.validateCanon(this.context, content, chapterId);
  }

  /**
   * Resolve a canon conflict.
   */
  async resolveConflict(
    errorId: string,
    action: CanonResolutionAction,
    newValue?: string,
    notes?: string
  ): Promise<{
    success: boolean;
    resolution?: CanonConflictResolution;
    error?: string;
  }> {
    const accessError = this.validateAccess('canonConflictResolution');
    if (accessError) {
      return {
        success: false,
        error: accessError.message,
      };
    }

    return StoryForgeEngine.resolveConflict(this.context, errorId, action, newValue, notes);
  }

  // ==========================================================================
  // Semantic Output (for Cinema translation)
  // ==========================================================================

  /**
   * Extract semantic scene output for cinema translation.
   *
   * This is the ONLY way cinema should access StoryForge data.
   * Cinema NEVER imports StoryForge internals directly.
   */
  async extractSemanticScene(sceneId: string): Promise<SemanticSceneOutput | null> {
    return StoryForgeEngine.extractSemanticScene(this.context, sceneId);
  }

  /**
   * Extract semantic outputs for all scenes in a chapter.
   */
  async extractChapterSemantics(chapterId: string): Promise<SemanticSceneOutput[]> {
    return StoryForgeEngine.extractChapterSemantics(this.context, chapterId);
  }
}

// ============================================================================
// Internal Engine (Not exported)
// ============================================================================

/**
 * Internal StoryForge Engine implementation.
 *
 * This is NOT exported and should NEVER be accessed directly.
 * All access goes through the StoryForgeAdapter.
 */
const StoryForgeEngine = {
  /**
   * Generate content using AI.
   */
  async generate(
    _context: StoryForgeContext,
    _request: StoryForgeGenerationRequest
  ): Promise<StoryForgeGenerationResult> {
    // TODO: Implement AI generation using OpenAI
    // This will integrate with the existing openai.ts utility
    return {
      success: true,
      content: '',
      creditsUsed: 0,
    };
  },

  /**
   * Validate content against canon.
   */
  async validateCanon(
    _context: StoryForgeContext,
    _content: string,
    _chapterId?: string
  ): Promise<{ valid: boolean; errors: CanonValidationError[] }> {
    // TODO: Implement canon validation
    return {
      valid: true,
      errors: [],
    };
  },

  /**
   * Resolve a canon conflict.
   */
  async resolveConflict(
    context: StoryForgeContext,
    errorId: string,
    action: CanonResolutionAction,
    newValue?: string,
    notes?: string
  ): Promise<{ success: boolean; resolution?: CanonConflictResolution; error?: string }> {
    // TODO: Implement conflict resolution
    return {
      success: true,
      resolution: {
        errorId,
        action,
        newValue,
        notes,
        resolvedBy: context.userId,
        resolvedAt: new Date().toISOString(),
      },
    };
  },

  /**
   * Extract semantic scene output.
   */
  async extractSemanticScene(
    _context: StoryForgeContext,
    sceneId: string
  ): Promise<SemanticSceneOutput | null> {
    // TODO: Implement semantic extraction
    return {
      sceneId,
      purpose: '',
      emotionalBeat: '',
      characterStates: [],
      visualElements: [],
      pacing: 'medium',
    };
  },

  /**
   * Extract chapter semantics.
   */
  async extractChapterSemantics(
    _context: StoryForgeContext,
    _chapterId: string
  ): Promise<SemanticSceneOutput[]> {
    // TODO: Implement chapter semantic extraction
    return [];
  },
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a StoryForge adapter for a user context.
 */
export function createStoryForgeAdapter(context: StoryForgeContext): StoryForgeAdapter {
  return new StoryForgeAdapter(context);
}

// ============================================================================
// Re-exports for convenient access
// ============================================================================

export type {
  Chapter,
  ChapterScene,
  CanonEntry,
  CanonVault,
  CanonValidationError,
  CanonConflictResolution,
  CanonResolutionAction,
  StoryForgeGenerationRequest,
  StoryForgeGenerationResult,
  SemanticSceneOutput,
};

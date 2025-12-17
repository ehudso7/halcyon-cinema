/**
 * Feature Flags Configuration
 *
 * This module defines all feature flags for the Halcyon Cinema platform.
 * Features are gated by subscription tier and project mode.
 *
 * IMPORTANT: Writer's Room is OPTIONAL - users with existing literary works
 * can continue using Halcyon Cinema without ever touching Writer's Room.
 */

// ============================================================================
// Subscription Tiers
// ============================================================================

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface TierFeatures {
  // Core Features
  maxProjects: number;
  maxScenesPerProject: number;
  maxCharactersPerProject: number;
  maxLoreEntriesPerProject: number;

  // Credits
  monthlyCredits: number;
  creditRolloverMultiplier: number;

  // Literary Works Features (available without Writer's Room)
  literaryWorks: {
    enabled: boolean;
    novelImport: boolean;
    manuscriptImport: boolean;
    screenplayImport: boolean;
    maxChaptersPerProject: number;
    maxWordsPerChapter: number;
    canonVault: boolean;
    canonLocking: boolean;
    canonVersioning: boolean;
  };

  // Writer's Room Features (optional escalation)
  writersRoom: {
    enabled: boolean;
    narrativeGeneration: boolean;
    chapterExpansion: boolean;
    sceneExpansion: boolean;
    rewriteCondenseContinue: boolean;
    longFormMemory: boolean;
    canonValidation: boolean;
    canonConflictResolution: boolean;
    aiAuthorControls: boolean;
  };

  // Cinema Features (optional escalation from Writer's Room or direct)
  cinema: {
    enabled: boolean;
    sceneToShotTranslation: boolean;
    cinematicPromptGeneration: boolean;
    visualPreviews: boolean;
    moodBoards: boolean;
    pitchDecks: boolean;
    productionBibles: boolean;
    videoGeneration: boolean;
    musicGeneration: boolean;
    voiceoverGeneration: boolean;
  };

  // Export Features
  exports: {
    pdf: boolean;
    docx: boolean;
    epub: boolean;
    fountain: boolean;
    markdown: boolean;
    zip: boolean;
  };

  // Advanced Features
  advanced: {
    teamCollaboration: boolean;
    apiAccess: boolean;
    customStyleTraining: boolean;
    prioritySupport: boolean;
    dedicatedSupport: boolean;
  };
}

// ============================================================================
// Tier Definitions
// ============================================================================

export const TIER_FEATURES: Record<SubscriptionTier, TierFeatures> = {
  free: {
    maxProjects: 3,
    maxScenesPerProject: 20,
    maxCharactersPerProject: 10,
    maxLoreEntriesPerProject: 20,
    monthlyCredits: 100,
    creditRolloverMultiplier: 1,

    literaryWorks: {
      enabled: true,
      novelImport: true,
      manuscriptImport: true,
      screenplayImport: false,
      maxChaptersPerProject: 10,
      maxWordsPerChapter: 10000,
      canonVault: true,
      canonLocking: false,
      canonVersioning: false,
    },

    writersRoom: {
      enabled: false,
      narrativeGeneration: false,
      chapterExpansion: false,
      sceneExpansion: false,
      rewriteCondenseContinue: false,
      longFormMemory: false,
      canonValidation: false,
      canonConflictResolution: false,
      aiAuthorControls: false,
    },

    cinema: {
      enabled: true,
      sceneToShotTranslation: true,
      cinematicPromptGeneration: true,
      visualPreviews: true,
      moodBoards: false,
      pitchDecks: false,
      productionBibles: false,
      videoGeneration: false,
      musicGeneration: false,
      voiceoverGeneration: false,
    },

    exports: {
      pdf: true,
      docx: false,
      epub: false,
      fountain: false,
      markdown: true,
      zip: true,
    },

    advanced: {
      teamCollaboration: false,
      apiAccess: false,
      customStyleTraining: false,
      prioritySupport: false,
      dedicatedSupport: false,
    },
  },

  pro: {
    maxProjects: 20,
    maxScenesPerProject: 100,
    maxCharactersPerProject: 50,
    maxLoreEntriesPerProject: 100,
    monthlyCredits: 500,
    creditRolloverMultiplier: 2,

    literaryWorks: {
      enabled: true,
      novelImport: true,
      manuscriptImport: true,
      screenplayImport: true,
      maxChaptersPerProject: 50,
      maxWordsPerChapter: 50000,
      canonVault: true,
      canonLocking: true,
      canonVersioning: true,
    },

    writersRoom: {
      enabled: true,
      narrativeGeneration: true,
      chapterExpansion: true,
      sceneExpansion: true,
      rewriteCondenseContinue: true,
      longFormMemory: true,
      canonValidation: true,
      canonConflictResolution: true,
      aiAuthorControls: true,
    },

    cinema: {
      enabled: true,
      sceneToShotTranslation: true,
      cinematicPromptGeneration: true,
      visualPreviews: true,
      moodBoards: true,
      pitchDecks: true,
      productionBibles: false,
      videoGeneration: true,
      musicGeneration: true,
      voiceoverGeneration: true,
    },

    exports: {
      pdf: true,
      docx: true,
      epub: true,
      fountain: true,
      markdown: true,
      zip: true,
    },

    advanced: {
      teamCollaboration: false,
      apiAccess: false,
      customStyleTraining: false,
      prioritySupport: true,
      dedicatedSupport: false,
    },
  },

  enterprise: {
    maxProjects: -1, // Unlimited
    maxScenesPerProject: -1,
    maxCharactersPerProject: -1,
    maxLoreEntriesPerProject: -1,
    monthlyCredits: 2000,
    creditRolloverMultiplier: 3,

    literaryWorks: {
      enabled: true,
      novelImport: true,
      manuscriptImport: true,
      screenplayImport: true,
      maxChaptersPerProject: -1, // Unlimited
      maxWordsPerChapter: -1,
      canonVault: true,
      canonLocking: true,
      canonVersioning: true,
    },

    writersRoom: {
      enabled: true,
      narrativeGeneration: true,
      chapterExpansion: true,
      sceneExpansion: true,
      rewriteCondenseContinue: true,
      longFormMemory: true,
      canonValidation: true,
      canonConflictResolution: true,
      aiAuthorControls: true,
    },

    cinema: {
      enabled: true,
      sceneToShotTranslation: true,
      cinematicPromptGeneration: true,
      visualPreviews: true,
      moodBoards: true,
      pitchDecks: true,
      productionBibles: true,
      videoGeneration: true,
      musicGeneration: true,
      voiceoverGeneration: true,
    },

    exports: {
      pdf: true,
      docx: true,
      epub: true,
      fountain: true,
      markdown: true,
      zip: true,
    },

    advanced: {
      teamCollaboration: true,
      apiAccess: true,
      customStyleTraining: true,
      prioritySupport: true,
      dedicatedSupport: true,
    },
  },
};

// ============================================================================
// Project Modes
// ============================================================================

/**
 * Project modes determine the available features and UI for a project.
 *
 * - 'literary': Pure literary work (novel, manuscript) - no Writer's Room, no Cinema
 * - 'writers-room': Writer's Room-enabled writing mode
 * - 'cinema': Cinema mode for visual production
 *
 * IMPORTANT: Users can work in 'literary' mode indefinitely without ever
 * using Writer's Room or Cinema features. Cinema is an OPTIONAL escalation.
 */
export type ProjectMode = 'literary' | 'writers-room' | 'cinema';

export interface ProjectModeConfig {
  name: string;
  description: string;
  allowedTransitions: ProjectMode[];
  features: string[];
}

export const PROJECT_MODE_CONFIG: Record<ProjectMode, ProjectModeConfig> = {
  literary: {
    name: 'Literary Works',
    description: 'Write novels, manuscripts, and screenplays with full creative control. No AI assistance required.',
    allowedTransitions: ['writers-room', 'cinema'],
    features: [
      'Novel writing and editing',
      'Manuscript management',
      'Chapter organization',
      'Character tracking',
      'Canon vault (read/write)',
      'Export to publishing formats',
    ],
  },
  'writers-room': {
    name: 'Writer\'s Room',
    description: 'AI-powered narrative engine for long-form writing with canon enforcement.',
    allowedTransitions: ['literary', 'cinema'],
    features: [
      'All Literary Works features',
      'AI narrative generation',
      'Chapter expansion',
      'Scene expansion',
      'Rewrite/condense/continue',
      'Long-form memory',
      'Canon validation',
      'Canon conflict resolution',
    ],
  },
  cinema: {
    name: 'Cinema',
    description: 'Transform your story into stunning visuals with AI-powered cinematic tools.',
    allowedTransitions: ['literary', 'writers-room'],
    features: [
      'Scene to shot translation',
      'Cinematic prompt generation',
      'Visual previews',
      'Mood boards',
      'Pitch decks',
      'Production bibles',
    ],
  },
};

// ============================================================================
// Feature Flag Utilities
// ============================================================================

/**
 * Check if a user has access to a specific feature based on their tier.
 */
export function hasFeatureAccess(
  tier: SubscriptionTier,
  featurePath: string
): boolean {
  const features = TIER_FEATURES[tier];
  const path = featurePath.split('.');

  let current: unknown = features;
  for (const segment of path) {
    if (typeof current !== 'object' || current === null) {
      return false;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current === true || (typeof current === 'number' && current !== 0);
}

/**
 * Get the feature limit for a user based on their tier.
 * Returns -1 for unlimited.
 */
export function getFeatureLimit(
  tier: SubscriptionTier,
  featurePath: string
): number {
  const features = TIER_FEATURES[tier];
  const path = featurePath.split('.');

  let current: unknown = features;
  for (const segment of path) {
    if (typeof current !== 'object' || current === null) {
      return 0;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === 'number' ? current : 0;
}

/**
 * Check if a project mode transition is valid.
 */
export function canTransitionMode(
  currentMode: ProjectMode,
  targetMode: ProjectMode
): boolean {
  if (currentMode === targetMode) {
    return true;
  }
  return PROJECT_MODE_CONFIG[currentMode].allowedTransitions.includes(targetMode);
}

/**
 * Check if a user can use cinema features.
 * Cinema features are only available for enterprise/pro tiers.
 */
export function canUseCinema(tier: SubscriptionTier): boolean {
  return TIER_FEATURES[tier].cinema.enabled;
}

/**
 * Check if a user can use Writer's Room features.
 * Writer's Room is an optional escalation available for pro/enterprise tiers.
 */
export function canUseWritersRoom(tier: SubscriptionTier): boolean {
  return TIER_FEATURES[tier].writersRoom.enabled;
}

/**
 * Check if a user can use literary works features.
 * Literary works are available to ALL tiers.
 */
export function canUseLiteraryWorks(tier: SubscriptionTier): boolean {
  return TIER_FEATURES[tier].literaryWorks.enabled;
}

/**
 * Get all available features for a tier as a flat list.
 */
export function getAvailableFeatures(tier: SubscriptionTier): string[] {
  const features: string[] = [];
  const tierFeatures = TIER_FEATURES[tier];

  // Literary Works
  if (tierFeatures.literaryWorks.enabled) {
    features.push('Literary Works Mode');
    if (tierFeatures.literaryWorks.novelImport) features.push('Novel Import');
    if (tierFeatures.literaryWorks.manuscriptImport) features.push('Manuscript Import');
    if (tierFeatures.literaryWorks.screenplayImport) features.push('Screenplay Import');
    if (tierFeatures.literaryWorks.canonVault) features.push('Canon Vault');
    if (tierFeatures.literaryWorks.canonLocking) features.push('Canon Locking');
    if (tierFeatures.literaryWorks.canonVersioning) features.push('Canon Versioning');
  }

  // Writer's Room
  if (tierFeatures.writersRoom.enabled) {
    features.push('Writer\'s Room Mode');
    if (tierFeatures.writersRoom.narrativeGeneration) features.push('AI Narrative Generation');
    if (tierFeatures.writersRoom.chapterExpansion) features.push('Chapter Expansion');
    if (tierFeatures.writersRoom.sceneExpansion) features.push('Scene Expansion');
    if (tierFeatures.writersRoom.canonValidation) features.push('Canon Validation');
  }

  // Cinema
  if (tierFeatures.cinema.enabled) {
    features.push('Cinema Mode');
    if (tierFeatures.cinema.visualPreviews) features.push('Visual Previews');
    if (tierFeatures.cinema.moodBoards) features.push('Mood Boards');
    if (tierFeatures.cinema.pitchDecks) features.push('Pitch Decks');
    if (tierFeatures.cinema.videoGeneration) features.push('Video Generation');
    if (tierFeatures.cinema.musicGeneration) features.push('Music Generation');
    if (tierFeatures.cinema.voiceoverGeneration) features.push('Voiceover Generation');
  }

  // Exports
  if (tierFeatures.exports.pdf) features.push('PDF Export');
  if (tierFeatures.exports.docx) features.push('DOCX Export');
  if (tierFeatures.exports.epub) features.push('EPUB Export');
  if (tierFeatures.exports.fountain) features.push('Fountain Export');
  if (tierFeatures.exports.markdown) features.push('Markdown Export');

  return features;
}

// ============================================================================
// Environment-based Feature Flags
// ============================================================================

/**
 * Runtime feature flags that can be toggled via environment variables.
 * These are for operational control, not tier-based access.
 */
export const RUNTIME_FLAGS = {
  // Core features
  ENABLE_WRITERS_ROOM: process.env.FEATURE_WRITERS_ROOM !== 'false',
  ENABLE_CINEMA: process.env.FEATURE_CINEMA !== 'false',
  ENABLE_LITERARY_WORKS: process.env.FEATURE_LITERARY_WORKS !== 'false',

  // AI features
  ENABLE_AI_GENERATION: process.env.FEATURE_AI_GENERATION !== 'false',
  ENABLE_VIDEO_GENERATION: process.env.FEATURE_VIDEO_GENERATION !== 'false',
  ENABLE_MUSIC_GENERATION: process.env.FEATURE_MUSIC_GENERATION !== 'false',

  // Export features
  ENABLE_EXPORTS: process.env.FEATURE_EXPORTS !== 'false',

  // Debug/Development
  ENABLE_DEMO_MODE: process.env.FEATURE_DEMO_MODE === 'true',
  ENABLE_DEBUG_LOGGING: process.env.FEATURE_DEBUG_LOGGING === 'true',
};

/**
 * Check if a runtime feature is enabled.
 */
export function isRuntimeFeatureEnabled(flag: keyof typeof RUNTIME_FLAGS): boolean {
  return RUNTIME_FLAGS[flag];
}

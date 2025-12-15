/**
 * Literary Works Types
 *
 * Types for managing novels, manuscripts, screenplays, and other literary content.
 * These types support users who want to use Halcyon Cinema for literary work
 * WITHOUT ever touching StoryForge.
 */

import { ProjectMode } from '@/config/feature-flags';

// ============================================================================
// Canon System Types
// ============================================================================

/**
 * Canon entry types for tracking story elements.
 */
export type CanonEntryType =
  | 'character'
  | 'location'
  | 'event'
  | 'rule'
  | 'theme'
  | 'reference'
  | 'timeline'
  | 'relationship';

/**
 * Canon entry status for locking and validation.
 */
export type CanonStatus = 'draft' | 'active' | 'locked' | 'deprecated';

/**
 * A single canon entry in the vault.
 */
export interface CanonEntry {
  id: string;
  projectId: string;
  type: CanonEntryType;
  name: string;
  summary: string;
  description?: string;
  status: CanonStatus;
  version: number;
  lockedAt?: string;
  lockedBy?: string;
  references: CanonReference[];
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Reference to a canon entry from content.
 */
export interface CanonReference {
  canonEntryId: string;
  sourceType: 'chapter' | 'scene' | 'character' | 'lore';
  sourceId: string;
  context?: string;
  validated: boolean;
  validatedAt?: string;
}

/**
 * Canon vault for a project.
 */
export interface CanonVault {
  projectId: string;
  entries: CanonEntry[];
  lastValidated?: string;
  validationErrors: CanonValidationError[];
}

/**
 * Canon validation error.
 */
export interface CanonValidationError {
  id: string;
  entryId: string;
  sourceId: string;
  errorType: 'conflict' | 'inconsistency' | 'missing_reference' | 'deprecated_reference';
  message: string;
  severity: 'warning' | 'error';
  suggestedResolution?: string;
  createdAt: string;
}

/**
 * Canon conflict resolution options.
 */
export type CanonResolutionAction =
  | 'keep_canon'      // Keep the canon entry, reject the conflicting content
  | 'update_canon'    // Update the canon entry with new information
  | 'fork_timeline'   // Create a new timeline branch
  | 'ignore';         // Ignore the conflict (not recommended)

export interface CanonConflictResolution {
  errorId: string;
  action: CanonResolutionAction;
  newValue?: string;
  notes?: string;
  resolvedBy: string;
  resolvedAt: string;
}

// ============================================================================
// Chapter Types
// ============================================================================

/**
 * Chapter status for workflow management.
 */
export type ChapterStatus = 'draft' | 'revision' | 'final' | 'published';

/**
 * A chapter in a literary work.
 */
export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  number: number;
  content: string;
  summary?: string;
  wordCount: number;
  status: ChapterStatus;
  scenes: ChapterScene[];
  canonReferences: CanonReference[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A scene within a chapter.
 */
export interface ChapterScene {
  id: string;
  chapterId: string;
  title?: string;
  order: number;
  content: string;
  purpose?: string;
  emotionalBeat?: string;
  conflict?: string;
  resolution?: string;
  characterIds: string[];
  locationId?: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Literary Work Types
// ============================================================================

/**
 * Type of literary work.
 */
export type LiteraryWorkType =
  | 'novel'
  | 'novella'
  | 'short-story'
  | 'manuscript'
  | 'screenplay'
  | 'teleplay'
  | 'stage-play'
  | 'series';

/**
 * Genre classification.
 */
export type Genre =
  | 'fiction'
  | 'non-fiction'
  | 'fantasy'
  | 'science-fiction'
  | 'mystery'
  | 'thriller'
  | 'romance'
  | 'horror'
  | 'literary'
  | 'historical'
  | 'young-adult'
  | 'childrens'
  | 'drama'
  | 'comedy'
  | 'action'
  | 'documentary'
  | 'other';

/**
 * Extended project type for literary works.
 */
export interface LiteraryProject {
  id: string;
  userId: string;
  name: string;
  description?: string;

  // Mode and type
  mode: ProjectMode;
  workType: LiteraryWorkType;
  genre: Genre;
  subGenres?: string[];

  // Content
  chapters: Chapter[];
  totalWordCount: number;
  targetWordCount?: number;

  // Canon
  canonVault?: CanonVault;
  canonEnabled: boolean;

  // Metadata
  synopsis?: string;
  logline?: string;
  targetAudience?: string;
  themes?: string[];

  // Status
  status: 'active' | 'completed' | 'archived';
  publishingReadiness?: 'draft' | 'editing' | 'ready';

  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastWrittenAt?: string;
}

// ============================================================================
// Character Types (Extended for Literary Works)
// ============================================================================

/**
 * Character role in the story.
 */
export type CharacterRole =
  | 'protagonist'
  | 'antagonist'
  | 'deuteragonist'
  | 'supporting'
  | 'minor'
  | 'mentioned';

/**
 * Extended character for literary works.
 */
export interface LiteraryCharacter {
  id: string;
  projectId: string;
  name: string;
  fullName?: string;
  aliases?: string[];

  // Role and importance
  role: CharacterRole;
  importance: number; // 1-10 scale

  // Description
  physicalDescription?: string;
  personality?: string;
  backstory?: string;
  motivation?: string;
  arc?: string;

  // Visual (for cinema mode)
  imageUrl?: string;
  visualTraits?: string[];

  // Canon
  isCanon: boolean;
  canonEntryId?: string;

  // Relationships
  relationships: CharacterRelationship[];

  // Timeline
  firstAppearance?: {
    chapterId: string;
    sceneId?: string;
  };

  // Metadata
  tags?: string[];
  notes?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * Relationship between characters.
 */
export interface CharacterRelationship {
  targetCharacterId: string;
  type: 'family' | 'romantic' | 'friend' | 'enemy' | 'colleague' | 'mentor' | 'other';
  description?: string;
  dynamic?: string;
}

// ============================================================================
// Location Types (Extended for Literary Works)
// ============================================================================

/**
 * Location for world-building.
 */
export interface LiteraryLocation {
  id: string;
  projectId: string;
  name: string;

  // Description
  description?: string;
  atmosphere?: string;
  significance?: string;

  // Visual (for cinema mode)
  imageUrl?: string;
  visualDetails?: string;

  // Hierarchy
  parentLocationId?: string;
  childLocationIds?: string[];

  // Canon
  isCanon: boolean;
  canonEntryId?: string;

  // Metadata
  tags?: string[];
  notes?: string;

  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Timeline Types
// ============================================================================

/**
 * Timeline event for story chronology.
 */
export interface TimelineEvent {
  id: string;
  projectId: string;
  name: string;
  description?: string;

  // Timing
  date?: string;
  relativeTime?: string;
  order: number;

  // Context
  chapterId?: string;
  sceneId?: string;
  characterIds?: string[];
  locationId?: string;

  // Canon
  isCanon: boolean;
  canonEntryId?: string;

  // Metadata
  tags?: string[];
  notes?: string;

  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Export Types
// ============================================================================

/**
 * Export format options.
 */
export type ExportFormat = 'pdf' | 'docx' | 'epub' | 'fountain' | 'markdown' | 'html' | 'txt';

/**
 * Export configuration.
 */
export interface ExportConfig {
  format: ExportFormat;
  includeChapters: string[] | 'all';
  includeTitlePage: boolean;
  includeTableOfContents: boolean;
  includeCharacterList: boolean;
  pageSize?: 'letter' | 'a4';
  fontFamily?: string;
  fontSize?: number;
  lineSpacing?: number;
  marginSize?: 'standard' | 'manuscript' | 'tight';
}

/**
 * Export result.
 */
export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
  createdAt: string;
}

// ============================================================================
// StoryForge Types (for optional escalation)
// ============================================================================

/**
 * StoryForge generation request.
 */
export interface StoryForgeGenerationRequest {
  projectId: string;
  action: 'generate' | 'expand' | 'rewrite' | 'condense' | 'continue';
  targetType: 'chapter' | 'scene' | 'paragraph';
  targetId?: string;
  prompt?: string;
  context?: {
    includeCanon: boolean;
    includeCharacters: boolean;
    includePreviousContent: boolean;
    maxContextTokens?: number;
  };
  options?: {
    tone?: string;
    style?: string;
    targetWordCount?: number;
    preserveElements?: string[];
  };
}

/**
 * StoryForge generation result.
 */
export interface StoryForgeGenerationResult {
  success: boolean;
  content?: string;
  canonValidation?: {
    valid: boolean;
    conflicts: CanonValidationError[];
  };
  wordCount?: number;
  creditsUsed: number;
  error?: string;
}

// ============================================================================
// Cinema Translation Types (for optional escalation)
// ============================================================================

/**
 * Semantic scene output from literary content.
 */
export interface SemanticSceneOutput {
  sceneId: string;
  title?: string;
  purpose: string;
  emotionalBeat: string;
  conflict?: string;
  resolution?: string;
  characterStates: Array<{
    characterId: string;
    state: string;
    emotion: string;
  }>;
  visualElements: string[];
  audioElements?: string[];
  pacing: 'slow' | 'medium' | 'fast';
}

/**
 * Shot generated from a scene.
 */
export interface CinematicShot {
  id: string;
  sceneId: string;
  order: number;
  shotType: string;
  description: string;
  visualPrompt: string;
  mood: string;
  lighting: string;
  cameraMovement?: string;
  duration?: number;
  imageUrl?: string;
  notes?: string;
}

/**
 * Shot template for different media types.
 */
export type MediaType = 'film' | 'tv' | 'animation' | 'game';

export interface ShotTemplate {
  mediaType: MediaType;
  shotTypes: string[];
  aspectRatios: string[];
  stylePresets: string[];
}

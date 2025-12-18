// Re-export literary types for convenient access
export * from './literary';

// Import ProjectMode for use in Project interface
import type { ProjectMode } from '@/config/feature-flags';

// Writer's Room feature types
export type WritersRoomFeatureId =
  | 'narrative-generation'
  | 'chapter-expansion'
  | 'scene-expansion'
  | 'rewrite-condense'
  | 'canon-validation'
  | 'ai-author-controls';

export const WRITERS_ROOM_FEATURE_IDS: readonly WritersRoomFeatureId[] = [
  'narrative-generation',
  'chapter-expansion',
  'scene-expansion',
  'rewrite-condense',
  'canon-validation',
  'ai-author-controls',
] as const;

export function isValidWritersRoomFeatureId(id: string): id is WritersRoomFeatureId {
  return WRITERS_ROOM_FEATURE_IDS.includes(id as WritersRoomFeatureId);
}

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  passwordHash?: string;
  password?: string; // For password validation (hashed)
  subscriptionTier?: 'starter' | 'pro' | 'enterprise';
  creditsRemaining?: number;
  createdAt: string;
  updatedAt: string;
}

// Character types
export interface Character {
  id: string;
  projectId: string;
  name: string;
  description: string;
  imageUrl?: string;
  traits: string[];
  appearances: CharacterAppearance[];
  createdAt: string;
  updatedAt: string;
}

export interface CharacterAppearance {
  sceneId: string;
  description?: string;
  changes?: string;
}

// Scene types
export interface Scene {
  id: string;
  projectId: string;
  prompt: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: SceneMetadata;
  characterIds?: string[];
  notes?: string;
}

export interface SceneMetadata {
  shotType?: string;
  style?: string;
  lighting?: string;
  mood?: string;
  aspectRatio?: string;
  mediaType?: 'image' | 'video';
}

// Project types
export interface Project {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  projectType?: ProjectType;
  // Mode support for literary works compatibility
  mode?: ProjectMode;
  workType?: LiteraryWorkType;
  genre?: string;
  synopsis?: string;
  logline?: string;
  totalWordCount?: number;
  targetWordCount?: number;
  publishingReadiness?: 'draft' | 'editing' | 'ready';
  canonEnabled?: boolean;
  lastWrittenAt?: string;
  scenes: Scene[];
  characters?: Character[];
  lore?: LoreEntry[];
  sequences?: SceneSequence[];
  // Cinema production settings
  cinemaSettings?: CinemaProductionSettings;
  createdAt: string;
  updatedAt: string;
}

// Cinema production settings for full video output
export interface CinemaProductionSettings {
  // Assembly toggle - enables full video assembly
  autoAssemble?: boolean;

  // Assembly preferences
  assemblyPreferences?: {
    resolution?: '720p' | '1080p' | '4k';
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
    transitionType?: 'cut' | 'fade' | 'dissolve' | 'wipe';
    transitionDuration?: number;
    format?: 'mp4' | 'webm' | 'gif';
    quality?: 'low' | 'medium' | 'high';
  };

  // Audio preferences
  audioPreferences?: {
    includeMusicTrack?: boolean;
    includeVoiceover?: boolean;
    musicVolume?: number; // 0-1
    voiceoverVolume?: number; // 0-1
    defaultVoice?: string;
  };

  // Generation preferences
  generationPreferences?: {
    videoQuality?: 'standard' | 'professional' | 'premium';
    musicGenre?: string;
    musicMood?: string;
  };
}

// Literary work types (re-exported from literary.ts)
export type LiteraryWorkType =
  | 'novel'
  | 'novella'
  | 'short-story'
  | 'manuscript'
  | 'screenplay'
  | 'teleplay'
  | 'stage-play'
  | 'series';

// Visual style presets
export interface VisualStyle {
  id: string;
  name: string;
  description: string;
  promptModifier: string;
  preview?: string;
}

// AI Assistant types
export interface AISuggestion {
  id: string;
  type: 'lighting' | 'mood' | 'composition' | 'story' | 'character' | 'style';
  title: string;
  description: string;
  promptAddition?: string;
}

// Image generation model types
export type ImageModel = 'dall-e-3' | 'gpt-image-1.5';

// Size options vary by model
export type DallE3Size = '1024x1024' | '1792x1024' | '1024x1792';
export type GptImageSize = '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
export type ImageSize = DallE3Size | GptImageSize;

// Output format (GPT Image 1.5 only)
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp';

// API types
export interface GenerateImageRequest {
  prompt: string;
  model?: ImageModel;
  size?: ImageSize;
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  outputFormat?: ImageOutputFormat; // GPT Image 1.5 only
}

/** Upsell suggestion for when credits are insufficient */
export interface UpsellSuggestion {
  buyCredits?: {
    description: string;
    creditsProvided: number;
    price: string;
  };
  upgradeSubscription?: {
    description: string;
    monthlyCredits: number;
    price: string;
  };
  useLowerTier?: {
    description: string;
    qualityTier: string;
    creditCost: number;
  };
}

export interface GenerateImageResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
  /** Indicates if the URL is 'permanent' (stored) or 'temporary' (will expire) */
  urlType?: 'permanent' | 'temporary';
  /** Warning message if image persistence failed or is not configured */
  warning?: string;
  /** Remaining credits after generation */
  creditsRemaining?: number;
  /** Credits used for this generation */
  creditsUsed?: number;
  /** Quality tier used for generation */
  qualityTier?: string;
}

export interface ApiError {
  error: string;
  details?: string;
  code?: string;
  creditsRemaining?: number;
  /** Credits required for the operation */
  creditsRequired?: number;
  /** Upsell suggestions when credits are insufficient */
  suggestions?: UpsellSuggestion;
}

// Lore Engine types
export type LoreType = 'character' | 'location' | 'event' | 'system';

export interface LoreEntry {
  id: string;
  projectId: string;
  type: LoreType;
  name: string;
  summary: string;
  description?: string;
  associatedScenes?: string[];
  tags?: string[];
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Scene Sequencer types
export interface ShotBlock {
  sceneId: string;
  order: number;
  title?: string;
  duration?: number; // seconds
  transitionType?: 'cut' | 'fade' | 'dissolve' | 'wipe';
  notes?: string;
}

export interface SceneSequence {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  shots: ShotBlock[];
  createdAt: string;
  updatedAt: string;
}

// Project types (extended)
export type ProjectType = 'film' | 'series' | 'visual-novel' | 'storyboard';

// Voiceover types
export interface VoiceoverClip {
  id: string;
  sceneId: string;
  text: string;
  voiceId?: string;
  audioUrl?: string;
  duration?: number;
  createdAt: string;
}

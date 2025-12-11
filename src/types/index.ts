// User types
export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  passwordHash?: string;
  password?: string; // For password validation (hashed)
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
}

// Project types
export interface Project {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  projectType?: ProjectType;
  scenes: Scene[];
  characters?: Character[];
  lore?: LoreEntry[];
  sequences?: SceneSequence[];
  createdAt: string;
  updatedAt: string;
}

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

// API types
export interface GenerateImageRequest {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
}

export interface GenerateImageResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
  /** Indicates if the URL is 'permanent' (stored) or 'temporary' (will expire) */
  urlType?: 'permanent' | 'temporary';
  /** Warning message if image persistence failed or is not configured */
  warning?: string;
}

export interface ApiError {
  error: string;
  details?: string;
  code?: string;
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

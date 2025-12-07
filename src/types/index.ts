// User types
export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  passwordHash?: string;
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
  scenes: Scene[];
  characters?: Character[];
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
}

export interface ApiError {
  error: string;
  details?: string;
}

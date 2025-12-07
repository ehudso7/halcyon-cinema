export interface Scene {
  id: string;
  projectId: string;
  prompt: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: SceneMetadata;
}

export interface SceneMetadata {
  shotType?: string;
  style?: string;
  lighting?: string;
  mood?: string;
  aspectRatio?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
}

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

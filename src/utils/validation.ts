import { z } from 'zod';

// Scene metadata schema
export const sceneMetadataSchema = z.object({
  shotType: z.enum(['wide', 'medium', 'closeup', 'extreme-closeup', 'aerial', 'pov']).optional(),
  lighting: z.enum(['natural', 'dramatic', 'soft', 'harsh', 'neon', 'golden-hour']).optional(),
  mood: z.enum(['happy', 'sad', 'tense', 'romantic', 'mysterious', 'action']).optional(),
});

// Shot block schema for sequences
export const shotBlockSchema = z.object({
  sceneId: z.string().min(1, 'Scene ID is required'),
  order: z.number().int().min(0),
  title: z.string().max(200).optional(),
  duration: z.number().int().min(1).max(3600).optional(),
  transitionType: z.enum(['cut', 'fade', 'dissolve', 'wipe']).optional(),
  notes: z.string().max(1000).optional(),
});

// Scene schemas
export const createSceneSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  prompt: z.string().min(1, 'Prompt is required').max(2000),
  characterIds: z.array(z.string()).optional(),
  metadata: sceneMetadataSchema.optional(),
});

export const updateSceneSchema = z.object({
  prompt: z.string().min(1).max(2000).optional(),
  characterIds: z.array(z.string()).optional(),
  metadata: sceneMetadataSchema.optional(),
});

// Sequence schemas
export const createSequenceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  shots: z.array(shotBlockSchema).optional(),
});

export const updateSequenceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  shots: z.array(shotBlockSchema).optional(),
});

// Character schemas
export const createCharacterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(2000).optional(),
  traits: z.array(z.string().max(50)).max(20).optional(),
  imageUrl: z.string().url().optional(),
});

export const updateCharacterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  traits: z.array(z.string().max(50)).max(20).optional(),
  imageUrl: z.string().url().optional(),
});

// Lore schemas
export const createLoreSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  type: z.enum(['world', 'character', 'event', 'location']),
  summary: z.string().min(1, 'Summary is required').max(500),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const updateLoreSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['world', 'character', 'event', 'location']).optional(),
  summary: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

// Project schemas
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  genre: z.string().max(50).optional(),
  visualStyle: z.string().max(100).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  genre: z.string().max(50).optional(),
  visualStyle: z.string().max(100).optional(),
});

// Image generation schema
export const generateImageSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(4000),
  style: z.string().max(100).optional(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).optional(),
});

// Generic validation helper
export function validateBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const result = schema.safeParse(body);
    if (result.success) {
      return { success: true, data: result.data };
    }
    const errorMessages = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    return { success: false, error: errorMessages };
  } catch {
    return { success: false, error: 'Invalid request body' };
  }
}

// Type exports for use in API handlers
export type CreateSceneInput = z.infer<typeof createSceneSchema>;
export type UpdateSceneInput = z.infer<typeof updateSceneSchema>;
export type CreateSequenceInput = z.infer<typeof createSequenceSchema>;
export type UpdateSequenceInput = z.infer<typeof updateSequenceSchema>;
export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
export type CreateLoreInput = z.infer<typeof createLoreSchema>;
export type UpdateLoreInput = z.infer<typeof updateLoreSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type GenerateImageInput = z.infer<typeof generateImageSchema>;
export type ShotBlock = z.infer<typeof shotBlockSchema>;

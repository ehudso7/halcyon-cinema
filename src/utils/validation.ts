import { z } from 'zod';

// Common schemas
export const uuidSchema = z.string().uuid();

// Scene metadata schema
export const sceneMetadataSchema = z.object({
  shotType: z.string().optional(),
  style: z.string().optional(),
  lighting: z.string().optional(),
  mood: z.string().optional(),
  aspectRatio: z.string().optional(),
}).optional();

// Scene schemas
export const createSceneSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  prompt: z.string().min(1, 'Prompt is required').max(4000, 'Prompt too long'),
  imageUrl: z.string().url().nullable().optional(),
  metadata: sceneMetadataSchema,
  characterIds: z.array(z.string().uuid()).optional(),
});

export const updateSceneSchema = z.object({
  prompt: z.string().min(1).max(4000).optional(),
  imageUrl: z.string().url().nullable().optional(),
  metadata: sceneMetadataSchema,
  characterIds: z.array(z.string().uuid()).optional(),
});

// Shot block schema
export const shotBlockSchema = z.object({
  sceneId: z.string().min(1, 'Scene ID is required'),
  order: z.number().int().min(0),
  title: z.string().max(200).optional(),
  duration: z.number().int().min(1).max(3600).optional(),
  transitionType: z.enum(['cut', 'fade', 'dissolve', 'wipe']).optional(),
  notes: z.string().max(1000).optional(),
});

// Sequence schemas
export const createSequenceSchema = z.object({
  name: z.string().min(1, 'Sequence name is required').max(200),
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
  name: z.string().min(1, 'Character name is required').max(100),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().nullable().optional(),
  attributes: z.record(z.string()).optional(),
});

export const updateCharacterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().nullable().optional(),
  attributes: z.record(z.string()).optional(),
});

// Lore schemas
export const loreTypeSchema = z.enum([
  'location',
  'event',
  'faction',
  'item',
  'concept',
  'history',
  'custom',
]);

export const createLoreSchema = z.object({
  title: z.string().min(1, 'Lore title is required').max(200),
  content: z.string().max(10000).optional(),
  type: loreTypeSchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  relatedIds: z.array(z.string().uuid()).optional(),
});

export const updateLoreSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(10000).optional(),
  type: loreTypeSchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  relatedIds: z.array(z.string().uuid()).optional(),
});

// Project schemas
export const projectTypeSchema = z.enum(['film', 'series', 'visual-novel', 'storyboard']);

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200),
  description: z.string().max(2000).optional(),
  projectType: projectTypeSchema.optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  genre: z.string().max(50).optional(),
  visualStyle: z.string().max(100).optional(),
  projectType: projectTypeSchema.optional(),
});

// Image generation schema
export const generateImageSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(4000),
  style: z.string().max(100).optional(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).optional(),
  size: z.enum(['1024x1024', '1792x1024', '1024x1792']).optional(),
});

// Helper function to validate and parse request body
export function validateBody<T extends z.ZodSchema>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(body);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format error messages
  const errors = result.error.errors.map(e => {
    const path = e.path.join('.');
    return path ? `${path}: ${e.message}` : e.message;
  });

  return { success: false, error: errors.join(', ') };
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

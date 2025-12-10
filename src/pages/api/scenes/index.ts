import type { NextApiRequest, NextApiResponse } from 'next';
import { addSceneToProjectAsync, getProjectByIdAsync } from '@/utils/storage';
import { Scene, ApiError } from '@/types';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Scene | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { projectId, prompt, imageUrl, metadata, characterIds } = req.body;

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Validate characterIds if provided
  if (characterIds !== undefined && characterIds !== null) {
    if (!Array.isArray(characterIds)) {
      return res.status(400).json({ error: 'characterIds must be an array' });
    }
    if (characterIds.some((id: unknown) => typeof id !== 'string')) {
      return res.status(400).json({ error: 'All characterIds must be strings' });
    }
  }

  try {
    const project = await getProjectByIdAsync(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify user owns this project (strict check - projects must have userId)
    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const scene = await addSceneToProjectAsync(
      projectId,
      prompt.trim(),
      imageUrl || null,
      metadata,
      characterIds
    );

    if (!scene) {
      return res.status(500).json({ error: 'Failed to create scene' });
    }

    return res.status(201).json(scene);
  } catch (error) {
    console.error('Scene creation error:', error);
    return res.status(500).json({ error: 'Failed to create scene' });
  }
}

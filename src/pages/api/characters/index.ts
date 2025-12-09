import type { NextApiRequest, NextApiResponse } from 'next';
import { getProjectByIdAsync, addCharacterToProjectAsync } from '@/utils/storage';
import { Character, ApiError } from '@/types';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Character | Character[] | ApiError>
) {
  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { projectId } = req.query;

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  const project = await getProjectByIdAsync(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Verify user owns this project (strict check - projects must have userId)
  if (project.userId !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'GET') {
    return res.status(200).json(project.characters || []);
  }

  if (req.method === 'POST') {
    const { name, description, traits, imageUrl } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Character name is required' });
    }

    if (!description || typeof description !== 'string') {
      return res.status(400).json({ error: 'Character description is required' });
    }

    const character = await addCharacterToProjectAsync(
      projectId,
      name.trim(),
      description.trim(),
      Array.isArray(traits) ? traits : [],
      imageUrl?.trim() || undefined
    );

    if (!character) {
      return res.status(500).json({ error: 'Failed to create character' });
    }

    return res.status(201).json(character);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

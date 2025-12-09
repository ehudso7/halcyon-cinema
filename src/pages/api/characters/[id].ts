import type { NextApiRequest, NextApiResponse } from 'next';
import { getProjectByIdAsync, getCharacterByIdAsync, updateCharacterAsync, deleteCharacterAsync } from '@/utils/storage';
import { Character, ApiError } from '@/types';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Character | ApiError | { success: boolean }>
) {
  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { id, projectId } = req.query;

  if (!id || typeof id !== 'string' || !projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid character or project ID' });
  }

  const project = await getProjectByIdAsync(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Verify user owns this project (strict check - projects must have userId)
  if (project.userId !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const character = await getCharacterByIdAsync(projectId, id);
  if (!character) {
    return res.status(404).json({ error: 'Character not found' });
  }

  if (req.method === 'GET') {
    return res.status(200).json(character);
  }

  if (req.method === 'PUT') {
    const { name, description, traits, imageUrl, appearances } = req.body;

    const updatedCharacter = await updateCharacterAsync(projectId, id, {
      ...(name && { name: name.trim() }),
      ...(description && { description: description.trim() }),
      ...(traits && { traits }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl?.trim() || undefined }),
      ...(appearances && { appearances }),
    });

    if (!updatedCharacter) {
      return res.status(500).json({ error: 'Failed to update character' });
    }

    return res.status(200).json(updatedCharacter);
  }

  if (req.method === 'DELETE') {
    const deleted = await deleteCharacterAsync(projectId, id);
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete character' });
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

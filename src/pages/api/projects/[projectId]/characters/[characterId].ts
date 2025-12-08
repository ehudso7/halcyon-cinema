import type { NextApiRequest, NextApiResponse } from 'next';
import { getProjectByIdAsync, getCharacterByIdAsync, updateCharacterAsync, deleteCharacterAsync } from '@/utils/storage';
import { Character } from '@/types';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Character | { error: string } | { success: boolean }>
) {
  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { projectId, characterId } = req.query;

  if (typeof projectId !== 'string' || typeof characterId !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID or character ID' });
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

    switch (req.method) {
      case 'GET': {
        const character = await getCharacterByIdAsync(projectId, characterId);
        if (!character) {
          return res.status(404).json({ error: 'Character not found' });
        }
        return res.status(200).json(character);
      }

      case 'PUT': {
        const { name, description, traits, imageUrl, appearances } = req.body;

        // Validate name if provided
        if (name !== undefined && (!name || typeof name !== 'string' || !name.trim())) {
          return res.status(400).json({ error: 'Character name must be a non-empty string' });
        }

        const updatedCharacter = await updateCharacterAsync(projectId, characterId, {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(traits !== undefined && { traits }),
          ...(imageUrl !== undefined && { imageUrl }),
          ...(appearances !== undefined && { appearances }),
        });

        if (!updatedCharacter) {
          return res.status(404).json({ error: 'Character not found' });
        }

        return res.status(200).json(updatedCharacter);
      }

      case 'DELETE': {
        const deleted = await deleteCharacterAsync(projectId, characterId);
        if (!deleted) {
          return res.status(404).json({ error: 'Character not found' });
        }
        return res.status(200).json({ success: true });
      }

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('Character API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

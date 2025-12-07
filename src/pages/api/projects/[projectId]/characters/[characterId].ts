import type { NextApiRequest, NextApiResponse } from 'next';
import { getProjectById, updateProject } from '@/utils/storage';
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

  const project = getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Verify user owns this project (strict check - projects must have userId)
  if (project.userId !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const characters = project.characters || [];
  const characterIndex = characters.findIndex(c => c.id === characterId);

  if (characterIndex === -1) {
    return res.status(404).json({ error: 'Character not found' });
  }

  switch (req.method) {
    case 'GET': {
      return res.status(200).json(characters[characterIndex]);
    }

    case 'PUT': {
      const { name, description, traits, imageUrl, appearances } = req.body;

      const updatedCharacter: Character = {
        ...characters[characterIndex],
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(traits !== undefined && { traits }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(appearances !== undefined && { appearances }),
        updatedAt: new Date().toISOString(),
      };

      characters[characterIndex] = updatedCharacter;
      updateProject(projectId, { characters });

      return res.status(200).json(updatedCharacter);
    }

    case 'DELETE': {
      characters.splice(characterIndex, 1);
      updateProject(projectId, { characters });

      return res.status(200).json({ success: true });
    }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

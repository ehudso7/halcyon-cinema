import type { NextApiRequest, NextApiResponse } from 'next';
import { getProjectById, updateProject } from '@/utils/storage';
import { Character, ApiError } from '@/types';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Character | ApiError | { success: boolean }>
) {
  const { id, projectId } = req.query;

  if (!id || typeof id !== 'string' || !projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid character or project ID' });
  }

  const project = getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const characters = project.characters || [];
  const characterIndex = characters.findIndex(c => c.id === id);

  if (characterIndex === -1) {
    return res.status(404).json({ error: 'Character not found' });
  }

  if (req.method === 'GET') {
    return res.status(200).json(characters[characterIndex]);
  }

  if (req.method === 'PUT') {
    const { name, description, traits, imageUrl, appearances } = req.body;

    characters[characterIndex] = {
      ...characters[characterIndex],
      ...(name && { name: name.trim() }),
      ...(description && { description: description.trim() }),
      ...(traits && { traits }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl?.trim() || undefined }),
      ...(appearances && { appearances }),
      updatedAt: new Date().toISOString(),
    };

    updateProject(projectId, { characters } as never);
    return res.status(200).json(characters[characterIndex]);
  }

  if (req.method === 'DELETE') {
    characters.splice(characterIndex, 1);
    updateProject(projectId, { characters } as never);
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

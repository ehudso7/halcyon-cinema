import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { getProjectById, updateProject } from '@/utils/storage';
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

  const project = getProjectById(projectId);
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

    const now = new Date().toISOString();
    const character: Character = {
      id: uuidv4(),
      projectId,
      name: name.trim(),
      description: description.trim(),
      imageUrl: imageUrl?.trim() || undefined,
      traits: Array.isArray(traits) ? traits : [],
      appearances: [],
      createdAt: now,
      updatedAt: now,
    };

    const characters = project.characters || [];
    characters.push(character);

    updateProject(projectId, { characters } as never);
    return res.status(201).json(character);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

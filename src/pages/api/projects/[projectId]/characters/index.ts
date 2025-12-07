import type { NextApiRequest, NextApiResponse } from 'next';
import { getProjectById, updateProject } from '@/utils/storage';
import { Character } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Character | Character[] | { error: string }>
) {
  const { projectId } = req.query;

  if (typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const project = getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  switch (req.method) {
    case 'GET': {
      return res.status(200).json(project.characters || []);
    }

    case 'POST': {
      const { name, description, traits, imageUrl } = req.body;

      if (!name || !description) {
        return res.status(400).json({ error: 'Name and description are required' });
      }

      const now = new Date().toISOString();
      const newCharacter: Character = {
        id: uuidv4(),
        projectId,
        name,
        description,
        traits: traits || [],
        imageUrl,
        appearances: [],
        createdAt: now,
        updatedAt: now,
      };

      const updatedCharacters = [...(project.characters || []), newCharacter];
      updateProject(projectId, { characters: updatedCharacters });

      return res.status(201).json(newCharacter);
    }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

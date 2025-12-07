import type { NextApiRequest, NextApiResponse } from 'next';
import { getProjectById, addLoreToProject, getProjectLore } from '@/utils/storage';
import { LoreEntry, LoreType } from '@/types';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoreEntry | LoreEntry[] | { error: string }>
) {
  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { projectId, type } = req.query;

  if (typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const project = getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Verify user owns this project (strict check - projects must have userId)
  if (project.userId !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  switch (req.method) {
    case 'GET': {
      const loreType = typeof type === 'string' ? type as LoreType : undefined;
      const lore = getProjectLore(projectId, loreType);
      return res.status(200).json(lore);
    }

    case 'POST': {
      const { type: entryType, name, summary, description, tags } = req.body;

      if (!entryType || !name || !summary) {
        return res.status(400).json({ error: 'Type, name, and summary are required' });
      }

      const validTypes: LoreType[] = ['character', 'location', 'event', 'system'];
      if (!validTypes.includes(entryType)) {
        return res.status(400).json({ error: 'Invalid lore type' });
      }

      const loreEntry = addLoreToProject(
        projectId,
        entryType as LoreType,
        name,
        summary,
        description,
        tags
      );

      if (!loreEntry) {
        return res.status(500).json({ error: 'Failed to create lore entry' });
      }

      return res.status(201).json(loreEntry);
    }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

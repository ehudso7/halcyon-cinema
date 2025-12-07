import type { NextApiRequest, NextApiResponse } from 'next';
import { getLoreByIdAsync, updateLoreAsync, deleteLoreAsync, getProjectByIdAsync } from '@/utils/storage';
import { LoreEntry } from '@/types';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoreEntry | { error: string } | { success: boolean }>
) {
  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { projectId, loreId } = req.query;

  if (typeof projectId !== 'string' || typeof loreId !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID or lore ID' });
  }

  try {
    // Verify user owns this project
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
        const loreEntry = await getLoreByIdAsync(projectId, loreId);
        if (!loreEntry) {
          return res.status(404).json({ error: 'Lore entry not found' });
        }
        return res.status(200).json(loreEntry);
      }

      case 'PUT': {
        const { name, summary, description, tags, associatedScenes, imageUrl } = req.body;

        const updated = await updateLoreAsync(projectId, loreId, {
          name,
          summary,
          description,
          tags,
          associatedScenes,
          imageUrl,
        });

        if (!updated) {
          return res.status(404).json({ error: 'Lore entry not found' });
        }

        return res.status(200).json(updated);
      }

      case 'DELETE': {
        const deleted = await deleteLoreAsync(projectId, loreId);
        if (!deleted) {
          return res.status(404).json({ error: 'Lore entry not found' });
        }
        return res.status(200).json({ success: true });
      }

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('Lore API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

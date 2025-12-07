import type { NextApiRequest, NextApiResponse } from 'next';
import { getProjectByIdAsync, updateProjectAsync, deleteProjectAsync } from '@/utils/storage';
import { Project, ApiError } from '@/types';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Project | ApiError | { success: boolean }>
) {
  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { projectId } = req.query;

  if (typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    // Get project and verify ownership
    const project = await getProjectByIdAsync(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify user owns this project (strict check - projects must have userId)
    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (req.method === 'GET') {
      return res.status(200).json(project);
    }

    if (req.method === 'PUT') {
      const { name, description } = req.body;

      // Validate name if provided
      if (name !== undefined && (!name || typeof name !== 'string' || !name.trim())) {
        return res.status(400).json({ error: 'Project name must be a non-empty string' });
      }

      const updated = await updateProjectAsync(projectId, {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() }),
      });
      if (!updated) {
        return res.status(500).json({ error: 'Failed to update project' });
      }
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const success = await deleteProjectAsync(projectId);
      if (!success) {
        return res.status(500).json({ error: 'Failed to delete project' });
      }
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (error) {
    console.error('Project API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

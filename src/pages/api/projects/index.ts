import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllProjectsAsync, createProjectAsync } from '@/utils/storage';
import { Project, ApiError } from '@/types';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Project | Project[] | ApiError>
) {
  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  if (req.method === 'GET') {
    try {
      // Filter projects by user
      const userProjects = await getAllProjectsAsync(userId);
      return res.status(200).json(userProjects);
    } catch (error) {
      console.error('Failed to get projects:', error);
      return res.status(500).json({ error: 'Failed to load projects' });
    }
  }

  if (req.method === 'POST') {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    try {
      const project = await createProjectAsync(name.trim(), description?.trim(), userId);
      return res.status(201).json(project);
    } catch (error) {
      console.error('Failed to create project:', error);
      return res.status(500).json({ error: 'Failed to create project' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

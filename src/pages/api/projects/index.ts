import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllProjects, createProject } from '@/utils/storage';
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
    // Filter projects by user
    const allProjects = getAllProjects();
    const userProjects = allProjects.filter(p => p.userId === userId);
    return res.status(200).json(userProjects);
  }

  if (req.method === 'POST') {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = createProject(name.trim(), description?.trim(), userId);
    return res.status(201).json(project);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

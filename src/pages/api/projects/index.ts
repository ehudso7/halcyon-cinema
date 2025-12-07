import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllProjects, createProject } from '@/utils/storage';
import { Project, ApiError } from '@/types';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Project | Project[] | ApiError>
) {
  if (req.method === 'GET') {
    const projects = getAllProjects();
    return res.status(200).json(projects);
  }

  if (req.method === 'POST') {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = createProject(name.trim(), description?.trim());
    return res.status(201).json(project);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

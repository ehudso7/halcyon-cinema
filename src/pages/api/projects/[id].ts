import type { NextApiRequest, NextApiResponse } from 'next';
import { getProjectById, updateProject, deleteProject } from '@/utils/storage';
import { Project, ApiError } from '@/types';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Project | ApiError | { success: boolean }>
) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  if (req.method === 'GET') {
    const project = getProjectById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    return res.status(200).json(project);
  }

  if (req.method === 'PUT') {
    const { name, description } = req.body;

    const project = updateProject(id, { name, description });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    return res.status(200).json(project);
  }

  if (req.method === 'DELETE') {
    const success = deleteProject(id);
    if (!success) {
      return res.status(404).json({ error: 'Project not found' });
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

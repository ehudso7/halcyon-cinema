import type { NextApiRequest, NextApiResponse } from 'next';
import { addSceneToProject, getProjectById } from '@/utils/storage';
import { Scene, ApiError } from '@/types';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Scene | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { projectId, prompt, imageUrl, metadata } = req.body;

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const project = getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const scene = addSceneToProject(projectId, prompt, imageUrl || null, metadata);

  if (!scene) {
    return res.status(500).json({ error: 'Failed to create scene' });
  }

  return res.status(201).json(scene);
}

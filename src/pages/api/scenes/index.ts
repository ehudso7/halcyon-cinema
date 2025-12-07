import type { NextApiRequest, NextApiResponse } from 'next';
import { addSceneToProject, getProjectById } from '@/utils/storage';
import { Scene, ApiError } from '@/types';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Scene | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { projectId, prompt, imageUrl, metadata } = req.body;

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const project = getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Verify user owns this project
  if (project.userId && project.userId !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const scene = addSceneToProject(projectId, prompt.trim(), imageUrl || null, metadata);

  if (!scene) {
    return res.status(500).json({ error: 'Failed to create scene' });
  }

  return res.status(201).json(scene);
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { getSceneById, updateScene, deleteScene } from '@/utils/storage';
import { Scene, ApiError } from '@/types';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Scene | ApiError | { success: boolean }>
) {
  const { id, projectId } = req.query;

  if (typeof id !== 'string' || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid scene or project ID' });
  }

  if (req.method === 'GET') {
    const scene = getSceneById(projectId, id);
    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    return res.status(200).json(scene);
  }

  if (req.method === 'PUT') {
    const { prompt, imageUrl, metadata } = req.body;

    const scene = updateScene(projectId, id, { prompt, imageUrl, metadata });
    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    return res.status(200).json(scene);
  }

  if (req.method === 'DELETE') {
    const success = deleteScene(projectId, id);
    if (!success) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

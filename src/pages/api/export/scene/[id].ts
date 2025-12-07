import type { NextApiRequest, NextApiResponse } from 'next';
import { getProjectById, getSceneById } from '@/utils/storage';
import { exportSceneAsZip } from '@/utils/export';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { id, projectId } = req.query;

  if (typeof id !== 'string' || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid scene or project ID' });
  }

  const project = getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const scene = getSceneById(projectId, id);
  if (!scene) {
    return res.status(404).json({ error: 'Scene not found' });
  }

  const sceneIndex = project.scenes.findIndex(s => s.id === id) + 1;

  try {
    const zipBuffer = await exportSceneAsZip(scene, sceneIndex);

    const filename = `scene-${sceneIndex.toString().padStart(3, '0')}`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}-export.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);

    return res.send(zipBuffer);
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ error: 'Failed to export scene' });
  }
}

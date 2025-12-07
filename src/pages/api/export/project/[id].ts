import type { NextApiRequest, NextApiResponse } from 'next';
import { getProjectById } from '@/utils/storage';
import { exportProjectAsZip } from '@/utils/export';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const project = getProjectById(id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Verify user owns this project
  if (project.userId && project.userId !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const zipBuffer = await exportProjectAsZip(project);

    // Sanitize filename
    const filename = project.name
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .toLowerCase();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}-export.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);

    return res.send(zipBuffer);
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ error: 'Failed to export project' });
  }
}

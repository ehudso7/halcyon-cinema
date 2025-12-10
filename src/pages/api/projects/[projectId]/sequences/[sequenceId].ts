import type { NextApiRequest, NextApiResponse } from 'next';
import { SceneSequence, ApiError } from '@/types';
import { requireAuth } from '@/utils/api-auth';
import { getProjectByIdAsync, updateSequenceAsync, deleteSequenceAsync } from '@/utils/storage';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SceneSequence | ApiError | { success: boolean }>
) {
  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { projectId, sequenceId } = req.query;

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  if (!sequenceId || typeof sequenceId !== 'string') {
    return res.status(400).json({ error: 'Sequence ID is required' });
  }

  // Verify project ownership
  const project = await getProjectByIdAsync(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  if (project.userId !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'PUT') {
    const { name, description, shots } = req.body;

    try {
      const sequence = await updateSequenceAsync(projectId, sequenceId, {
        name,
        description,
        shots,
      });

      if (!sequence) {
        return res.status(404).json({ error: 'Sequence not found' });
      }

      return res.status(200).json(sequence);
    } catch (error) {
      console.error('Error updating sequence:', error);
      return res.status(500).json({ error: 'Failed to update sequence' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const deleted = await deleteSequenceAsync(projectId, sequenceId);
      if (!deleted) {
        return res.status(404).json({ error: 'Sequence not found' });
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting sequence:', error);
      return res.status(500).json({ error: 'Failed to delete sequence' });
    }
  }

  res.setHeader('Allow', ['PUT', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

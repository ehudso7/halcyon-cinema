import type { NextApiRequest, NextApiResponse } from 'next';
import { SceneSequence, ApiError } from '@/types';
import { requireAuth } from '@/utils/api-auth';
import { getProjectByIdAsync, addSequenceToProjectAsync, getProjectSequencesAsync } from '@/utils/storage';
import { createSequenceSchema, validateBody } from '@/utils/validation';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SceneSequence | SceneSequence[] | ApiError>
) {
  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { projectId } = req.query;

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  // Verify project ownership
  const project = await getProjectByIdAsync(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  if (project.userId !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'GET') {
    try {
      const sequences = await getProjectSequencesAsync(projectId);
      return res.status(200).json(sequences);
    } catch (error) {
      console.error('Error fetching sequences:', error);
      return res.status(500).json({ error: 'Failed to fetch sequences' });
    }
  }

  if (req.method === 'POST') {
    // Validate request body with Zod
    const validation = validateBody(createSequenceSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    const { name, description, shots } = validation.data;

    try {
      const sequence = await addSequenceToProjectAsync(projectId, name.trim(), description, shots);
      if (!sequence) {
        return res.status(500).json({ error: 'Failed to create sequence' });
      }
      return res.status(201).json(sequence);
    } catch (error) {
      console.error('Error creating sequence:', error);
      return res.status(500).json({ error: 'Failed to create sequence' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

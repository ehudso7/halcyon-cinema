import type { NextApiRequest, NextApiResponse } from 'next';
import { SceneSequence, ApiError } from '@/types';
import { requireAuth } from '@/utils/api-auth';
import { getProjectByIdAsync, addSequenceToProjectAsync, getProjectSequencesAsync } from '@/utils/storage';

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
    const { name, description, shots } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Sequence name is required' });
    }

    // Validate shots if provided
    if (shots !== undefined && shots !== null) {
      if (!Array.isArray(shots)) {
        return res.status(400).json({ error: 'shots must be an array' });
      }
      // Validate shot structure
      for (const shot of shots) {
        if (typeof shot !== 'object' || shot === null) {
          return res.status(400).json({ error: 'Each shot must be an object' });
        }
        if (typeof shot.sceneId !== 'string') {
          return res.status(400).json({ error: 'Each shot must have a valid sceneId' });
        }
      }
    }

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

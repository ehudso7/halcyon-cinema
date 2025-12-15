/**
 * Project Mode API
 *
 * Handles project mode management (literary, storyforge, cinema).
 *
 * GET: Get current project mode
 * PUT: Update project mode (with tier validation)
 *
 * IMPORTANT: This endpoint ensures users with existing literary works can
 * continue using Halcyon Cinema without ever touching StoryForge.
 * Literary mode is ALWAYS available to all tiers.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { dbGetProjectById, dbUpdateProject } from '@/utils/db';
import { dbUpdateProjectMode, dbGetProjectMode } from '@/utils/db-literary';
import { getUserTierInfo, checkModeTransition } from '@/utils/tier-gating';
import type { ProjectMode } from '@/config/feature-flags';

interface ModeResponse {
  mode: ProjectMode;
  availableModes: ProjectMode[];
}

interface ErrorResponse {
  error: string;
  message?: string;
  currentTier?: string;
  requiredTier?: string;
  availableModes?: ProjectMode[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ModeResponse | ErrorResponse>
) {
  // Authenticate user
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { projectId } = req.query;
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  // Verify project ownership
  const project = await dbGetProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  if (project.userId !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Get user tier info
  const tierInfo = await getUserTierInfo(req, res);
  if (!tierInfo) {
    return res.status(401).json({ error: 'Unable to determine subscription tier' });
  }

  if (req.method === 'GET') {
    // Get current mode and available modes
    const currentMode = await dbGetProjectMode(projectId) || 'literary';

    // Determine available modes based on tier
    const availableModes: ProjectMode[] = ['literary']; // Always available

    // Check for StoryForge access
    if (tierInfo.features.storyforge.enabled) {
      availableModes.push('storyforge');
    }

    // Check for Cinema access
    if (tierInfo.features.cinema.enabled) {
      availableModes.push('cinema');
    }

    return res.status(200).json({
      mode: currentMode,
      availableModes,
    });
  }

  if (req.method === 'PUT') {
    const { mode } = req.body as { mode?: ProjectMode };

    if (!mode) {
      return res.status(400).json({ error: 'Mode is required' });
    }

    const validModes: ProjectMode[] = ['literary', 'storyforge', 'cinema'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({
        error: 'Invalid mode',
        message: `Mode must be one of: ${validModes.join(', ')}`,
      });
    }

    // Get current mode
    const currentMode = await dbGetProjectMode(projectId) || 'literary';

    // Check if transition is allowed
    const transitionResult = checkModeTransition(tierInfo.tier, currentMode, mode);

    if (!transitionResult.allowed) {
      // Determine available modes for the error response
      const availableModes: ProjectMode[] = ['literary'];
      if (tierInfo.features.storyforge.enabled) availableModes.push('storyforge');
      if (tierInfo.features.cinema.enabled) availableModes.push('cinema');

      return res.status(403).json({
        error: 'Mode transition not allowed',
        message: transitionResult.reason,
        currentTier: tierInfo.tier,
        requiredTier: transitionResult.requiredTier,
        availableModes,
      });
    }

    // Update project mode
    const success = await dbUpdateProjectMode(projectId, mode);

    if (!success) {
      return res.status(500).json({ error: 'Failed to update project mode' });
    }

    // Also update project_type for compatibility
    let projectType = project.projectType;
    if (mode === 'cinema' && !projectType) {
      projectType = 'film';
    } else if (mode === 'literary' && !projectType) {
      projectType = 'visual-novel';
    }

    if (projectType !== project.projectType) {
      await dbUpdateProject(projectId, { projectType });
    }

    // Determine available modes
    const availableModes: ProjectMode[] = ['literary'];
    if (tierInfo.features.storyforge.enabled) availableModes.push('storyforge');
    if (tierInfo.features.cinema.enabled) availableModes.push('cinema');

    return res.status(200).json({
      mode,
      availableModes,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

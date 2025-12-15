/**
 * Canon Vault API
 *
 * Handles canon entry management for literary works projects.
 *
 * GET: List all canon entries for a project
 * POST: Create a new canon entry
 *
 * IMPORTANT: Canon vault is available to ALL tiers for basic usage.
 * Canon locking and versioning require higher tiers.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { dbGetProjectById } from '@/utils/db';
import {
  dbCreateCanonEntry,
  dbGetProjectCanonEntries,
} from '@/utils/db-literary';
import { getUserTierInfo } from '@/utils/tier-gating';
import type { CanonEntry, CanonEntryType } from '@/types/literary';

interface CanonResponse {
  entries: CanonEntry[];
  canLock: boolean;
  canVersion: boolean;
}

interface CreateCanonResponse {
  entry: CanonEntry;
}

interface ErrorResponse {
  error: string;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CanonResponse | CreateCanonResponse | ErrorResponse>
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

  // Check if canon vault is enabled
  if (!tierInfo.features.literaryWorks.canonVault) {
    return res.status(403).json({
      error: 'Canon vault not available',
      message: 'Canon vault requires a higher subscription tier',
    });
  }

  if (req.method === 'GET') {
    // Get optional type filter
    const { type } = req.query;
    const entryType = type && typeof type === 'string' ? type as CanonEntryType : undefined;

    // List all canon entries
    const entries = await dbGetProjectCanonEntries(projectId, entryType);

    return res.status(200).json({
      entries,
      canLock: tierInfo.features.literaryWorks.canonLocking,
      canVersion: tierInfo.features.literaryWorks.canonVersioning,
    });
  }

  if (req.method === 'POST') {
    const { type, name, summary, description, tags } = req.body as {
      type?: CanonEntryType;
      name?: string;
      summary?: string;
      description?: string;
      tags?: string[];
    };

    if (!type || !name || !summary) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'type, name, and summary are required',
      });
    }

    const validTypes: CanonEntryType[] = [
      'character', 'location', 'event', 'rule',
      'theme', 'reference', 'timeline', 'relationship'
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid type',
        message: `Type must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Create the canon entry
    const entry = await dbCreateCanonEntry(
      projectId,
      type,
      name,
      summary,
      description,
      tags
    );

    if (!entry) {
      return res.status(500).json({ error: 'Failed to create canon entry' });
    }

    return res.status(201).json({ entry });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

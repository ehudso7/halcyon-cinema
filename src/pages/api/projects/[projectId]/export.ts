/**
 * Export API
 *
 * Handles exporting literary works to various publishing-ready formats.
 *
 * POST: Export project to specified format
 * GET: Get available export formats for user's tier
 *
 * IMPORTANT: Basic exports (PDF, Markdown) are available to ALL tiers.
 * Advanced formats require higher subscription tiers.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { dbGetProjectById } from '@/utils/db';
import { getUserTierInfo } from '@/utils/tier-gating';
import {
  createExportAdapter,
  getAvailableFormats,
} from '@/services/export';
import type { ExportFormat, ExportConfig, ExportResult } from '@/types/literary';

interface AvailableFormatsResponse {
  formats: ExportFormat[];
}

interface ErrorResponse {
  error: string;
  message?: string;
  availableFormats?: ExportFormat[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExportResult | AvailableFormatsResponse | ErrorResponse>
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

  // Create export adapter
  const exportAdapter = createExportAdapter({
    userId,
    projectId,
    tier: tierInfo.tier,
  });

  if (req.method === 'GET') {
    // Return available export formats
    const formats = getAvailableFormats(tierInfo.tier);
    return res.status(200).json({ formats });
  }

  if (req.method === 'POST') {
    const {
      format,
      includeChapters = 'all',
      includeTitlePage = true,
      includeTableOfContents = true,
      includeCharacterList = false,
      pageSize,
      fontFamily,
      fontSize,
      lineSpacing,
      marginSize,
    } = req.body as Partial<ExportConfig> & { format?: ExportFormat };

    if (!format) {
      return res.status(400).json({
        error: 'Export format is required',
        availableFormats: exportAdapter.getAvailableFormats(),
      });
    }

    // Check if format is available
    if (!exportAdapter.canExport(format)) {
      return res.status(403).json({
        error: 'Export format not available',
        message: `${format.toUpperCase()} export requires a higher subscription tier`,
        availableFormats: exportAdapter.getAvailableFormats(),
      });
    }

    // Build export config
    const config: ExportConfig = {
      format,
      includeChapters,
      includeTitlePage,
      includeTableOfContents,
      includeCharacterList,
      pageSize,
      fontFamily,
      fontSize,
      lineSpacing,
      marginSize,
    };

    // Perform export
    const result = await exportAdapter.export(config);

    if (!result.success) {
      return res.status(500).json({
        error: 'Export failed',
        message: result.error,
      });
    }

    return res.status(200).json(result);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

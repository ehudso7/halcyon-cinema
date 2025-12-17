/**
 * Production Documents API
 *
 * Generates professional production documents for cinema projects:
 * - Pitch Deck: Brief presentation for pitching to studios/investors
 * - Production Bible: Comprehensive reference for film/TV production
 * - Shot List: Detailed shot breakdown for scenes
 *
 * POST: Generate a specific document type
 * GET: Get available document types for user's tier
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { dbGetProjectById } from '@/utils/db';
import { dbGetProjectMode } from '@/utils/db-literary';
import { getUserTierInfo } from '@/utils/tier-gating';
import { createCinemaAdapter } from '@/services/cinema';
import type { ProjectMode } from '@/config/feature-flags';

type DocumentType = 'pitch-deck' | 'production-bible' | 'shot-list';

interface AvailableDocsResponse {
  availableDocuments: DocumentType[];
  projectMode: ProjectMode;
}

interface DocumentGenerationResponse {
  success: boolean;
  documentType: DocumentType;
  content?: string;
  fileUrl?: string;
  error?: string;
}

interface ErrorResponse {
  error: string;
  message?: string;
  requiredMode?: ProjectMode;
  requiredTier?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DocumentGenerationResponse | AvailableDocsResponse | ErrorResponse>
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

  // Get project mode
  const projectMode = await dbGetProjectMode(projectId) || 'literary';

  if (req.method === 'GET') {
    // Return available document types based on tier and mode
    const availableDocuments: DocumentType[] = [];

    // Shot list is available to all cinema users
    if (tierInfo.features.cinema.sceneToShotTranslation) {
      availableDocuments.push('shot-list');
    }

    // Pitch deck requires pro tier
    if (tierInfo.features.cinema.pitchDecks) {
      availableDocuments.push('pitch-deck');
    }

    // Production bible requires enterprise tier
    if (tierInfo.features.cinema.productionBibles) {
      availableDocuments.push('production-bible');
    }

    return res.status(200).json({
      availableDocuments,
      projectMode,
    });
  }

  if (req.method === 'POST') {
    const { documentType, sceneId } = req.body as {
      documentType?: DocumentType;
      sceneId?: string; // For shot list generation
    };

    if (!documentType) {
      return res.status(400).json({
        error: 'Document type is required',
        message: 'Specify one of: pitch-deck, production-bible, shot-list',
      });
    }

    // Create cinema adapter
    const cinemaAdapter = createCinemaAdapter({
      userId,
      projectId,
      tier: tierInfo.tier,
      mode: projectMode,
    });

    // Check if cinema is available
    if (!cinemaAdapter.isAvailable()) {
      return res.status(403).json({
        error: 'Cinema features not available',
        message: 'Cinema features require a paid subscription',
        requiredTier: 'pro',
      });
    }

    // Check project mode for production documents
    if (documentType !== 'shot-list' && projectMode !== 'cinema') {
      return res.status(403).json({
        error: 'Project not in Cinema mode',
        message: 'Production documents require the project to be in Cinema mode',
        requiredMode: 'cinema',
      });
    }

    switch (documentType) {
      case 'pitch-deck': {
        const result = await cinemaAdapter.generatePitchDeck();
        return res.status(result.success ? 200 : 500).json({
          success: result.success,
          documentType: 'pitch-deck',
          content: result.deckContent,
          fileUrl: result.deckUrl,
          error: result.error,
        });
      }

      case 'production-bible': {
        const result = await cinemaAdapter.generateProductionBible();
        return res.status(result.success ? 200 : 500).json({
          success: result.success,
          documentType: 'production-bible',
          content: result.bibleContent,
          fileUrl: result.bibleUrl,
          error: result.error,
        });
      }

      case 'shot-list': {
        if (!sceneId) {
          return res.status(400).json({
            error: 'Scene ID required',
            message: 'Shot list generation requires a scene ID',
          });
        }

        // Generate shot list for the scene
        // For now, create a semantic scene placeholder and generate shots
        const semanticScene = {
          sceneId,
          purpose: project.description || 'Scene visualization',
          emotionalBeat: 'dramatic',
          visualElements: ['cinematic composition', 'atmospheric lighting'],
          pacing: 'medium' as const,
          characterStates: [],
        };

        const result = await cinemaAdapter.translateSceneToShots(semanticScene, 'film', {
          targetShotCount: 5,
        });

        if (!result.success) {
          return res.status(500).json({
            success: false,
            documentType: 'shot-list',
            error: result.error,
          });
        }

        // Format shots as markdown content
        const shotListContent = formatShotList(result.shots, sceneId);

        return res.status(200).json({
          success: true,
          documentType: 'shot-list',
          content: shotListContent,
        });
      }

      default:
        return res.status(400).json({
          error: 'Invalid document type',
          message: 'Specify one of: pitch-deck, production-bible, shot-list',
        });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * Format shots array into a markdown shot list.
 */
function formatShotList(
  shots: Array<{
    id: string;
    order: number;
    shotType: string;
    description: string;
    visualPrompt: string;
    mood: string;
    lighting: string;
    cameraMovement?: string;
    duration?: number;
  }>,
  sceneId: string
): string {
  const lines: string[] = [];

  lines.push('# SHOT LIST');
  lines.push('');
  lines.push(`**Scene ID:** ${sceneId}`);
  lines.push(`**Total Shots:** ${shots.length}`);
  lines.push(`**Generated:** ${new Date().toLocaleDateString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('| # | Shot Type | Description | Mood | Lighting |');
  lines.push('|---|-----------|-------------|------|----------|');

  shots.forEach((shot) => {
    lines.push(
      `| ${shot.order} | ${shot.shotType} | ${shot.description} | ${shot.mood} | ${shot.lighting} |`
    );
  });

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## DETAILED BREAKDOWN');
  lines.push('');

  shots.forEach((shot) => {
    lines.push(`### Shot ${shot.order}: ${shot.shotType.toUpperCase()}`);
    lines.push('');
    lines.push(`**Description:** ${shot.description}`);
    lines.push(`**Visual Prompt:** ${shot.visualPrompt}`);
    lines.push(`**Mood:** ${shot.mood}`);
    lines.push(`**Lighting:** ${shot.lighting}`);
    if (shot.cameraMovement) {
      lines.push(`**Camera Movement:** ${shot.cameraMovement}`);
    }
    if (shot.duration) {
      lines.push(`**Estimated Duration:** ${shot.duration} seconds`);
    }
    lines.push('');
  });

  lines.push('---');
  lines.push('*Generated by Halcyon Cinema*');

  return lines.join('\n');
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { dbGetProjectById } from '@/utils/db';
import type { CinemaProductionSettings, ApiError } from '@/types';

interface CinemaSettingsResponse {
  success: boolean;
  settings?: CinemaProductionSettings;
  error?: string;
}

/**
 * Default cinema settings.
 * These are returned for all projects as cinema settings are not yet persisted to DB.
 * Settings can be passed with each assembly/generation request to override defaults.
 */
const DEFAULT_CINEMA_SETTINGS: CinemaProductionSettings = {
  autoAssemble: false,
  assemblyPreferences: {
    resolution: '1080p',
    aspectRatio: '16:9',
    transitionType: 'fade',
    transitionDuration: 0.5,
    format: 'mp4',
    quality: 'high',
  },
  audioPreferences: {
    includeMusicTrack: true,
    includeVoiceover: true,
    musicVolume: 0.3,
    voiceoverVolume: 1,
    defaultVoice: 'nova',
  },
  generationPreferences: {
    videoQuality: 'standard',
    musicGenre: 'cinematic',
    musicMood: 'dramatic',
  },
};

/**
 * Cinema Settings API
 *
 * GET: Returns default cinema production settings for a project.
 *
 * Note: Settings are currently not persisted to database.
 * Pass settings with each assembly/generation request to customize.
 * Future: Add cinema_settings JSONB column to projects table.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CinemaSettingsResponse | ApiError>
) {
  const { projectId } = req.query;

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'projectId is required' });
  }

  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  // GET - Return default settings
  if (req.method === 'GET') {
    // Verify project exists and user has access
    const project = await dbGetProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId && project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.status(200).json({
      success: true,
      settings: DEFAULT_CINEMA_SETTINGS,
    });
  }

  // Future: PUT/PATCH for persisting settings when DB migration is done
  if (req.method === 'PUT' || req.method === 'PATCH') {
    return res.status(501).json({
      error: 'Setting persistence not yet implemented. Pass settings with each request.',
    });
  }

  res.setHeader('Allow', ['GET']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

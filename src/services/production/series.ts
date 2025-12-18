/**
 * Series & Movie Production Service
 *
 * Handles production of long-form content:
 * - TV Series: Multiple episodes with continuity
 * - Movies: Feature-length content broken into acts
 *
 * APPROACH:
 * - Break long content into manageable segments (episodes/acts)
 * - Produce each segment using the episode production service
 * - Track continuity (characters, settings, plot) across segments
 * - Queue productions for batch processing
 */

import {
  produceEpisode,
  estimateProductionCredits,
  type ProductionRequest,
  type ProductionResult,
  type SceneInput,
} from './index';
import type { CinemaProductionSettings } from '@/types';

// ============================================================================
// Types
// ============================================================================

export type ProductionType = 'episode' | 'series' | 'movie';

export interface SeriesConfig {
  title: string;
  genre: string;
  synopsis: string;
  seasonNumber?: number;
  episodeCount: number;
  episodeDuration: number; // seconds per episode

  // Story continuity
  mainCharacters?: CharacterProfile[];
  setting?: string;
  overarchingPlot?: string;

  // Episode details
  episodes: EpisodeConfig[];
}

export interface EpisodeConfig {
  episodeNumber: number;
  title: string;
  synopsis: string;
  scenes?: SceneInput[];
  plotPoints?: string[];
}

export interface MovieConfig {
  title: string;
  genre: string;
  synopsis: string;
  targetDuration: number; // total minutes

  // Story structure
  mainCharacters?: CharacterProfile[];
  setting?: string;

  // Three-act structure
  acts: ActConfig[];
}

export interface ActConfig {
  actNumber: number;
  title: string;
  synopsis: string;
  duration: number; // minutes
  scenes?: SceneInput[];
  plotPoints?: string[];
}

export interface CharacterProfile {
  name: string;
  description: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  traits?: string[];
}

export interface SeriesProductionRequest {
  projectId: string;
  userId: string;
  type: 'series';
  config: SeriesConfig;
  settings?: CinemaProductionSettings;
}

export interface MovieProductionRequest {
  projectId: string;
  userId: string;
  type: 'movie';
  config: MovieConfig;
  settings?: CinemaProductionSettings;
}

export interface BatchProductionProgress {
  type: ProductionType;
  title: string;
  totalSegments: number;
  completedSegments: number;
  currentSegment?: string;
  overallProgress: number; // 0-100
  segmentResults: Array<{
    segmentId: string;
    title: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    videoUrl?: string;
    error?: string;
  }>;
  errors: string[];
}

export interface BatchProductionResult {
  success: boolean;
  type: ProductionType;
  title: string;
  videos: Array<{
    segmentId: string;
    title: string;
    videoUrl: string;
    duration: number;
  }>;
  totalDuration: number;
  totalCreditsUsed: number;
  progress: BatchProductionProgress;
  error?: string;
}

// ============================================================================
// Credit Estimation
// ============================================================================

/**
 * Estimate credits for a series production.
 */
export function estimateSeriesCredits(config: SeriesConfig): {
  total: number;
  perEpisode: number;
  breakdown: {
    video: number;
    music: number;
    voiceover: number;
    assembly: number;
  };
} {
  const perEpisodeEstimate = estimateProductionCredits({
    projectId: '',
    userId: '',
    targetDuration: config.episodeDuration,
  });

  const episodeCount = config.episodes.length || config.episodeCount;

  return {
    total: perEpisodeEstimate.total * episodeCount,
    perEpisode: perEpisodeEstimate.total,
    breakdown: {
      video: perEpisodeEstimate.breakdown.video * episodeCount,
      music: perEpisodeEstimate.breakdown.music * episodeCount,
      voiceover: perEpisodeEstimate.breakdown.voiceover * episodeCount,
      assembly: perEpisodeEstimate.breakdown.assembly * episodeCount,
    },
  };
}

/**
 * Estimate credits for a movie production.
 */
export function estimateMovieCredits(config: MovieConfig): {
  total: number;
  perAct: number;
  breakdown: {
    video: number;
    music: number;
    voiceover: number;
    assembly: number;
  };
} {
  const actCount = config.acts.length || 3;
  const durationPerAct = (config.targetDuration * 60) / actCount;

  const perActEstimate = estimateProductionCredits({
    projectId: '',
    userId: '',
    targetDuration: durationPerAct,
  });

  return {
    total: perActEstimate.total * actCount,
    perAct: perActEstimate.total,
    breakdown: {
      video: perActEstimate.breakdown.video * actCount,
      music: perActEstimate.breakdown.music * actCount,
      voiceover: perActEstimate.breakdown.voiceover * actCount,
      assembly: perActEstimate.breakdown.assembly * actCount,
    },
  };
}

// ============================================================================
// Series Production
// ============================================================================

/**
 * Produce a full series (multiple episodes).
 */
export async function produceSeries(
  request: SeriesProductionRequest,
  onProgress?: (progress: BatchProductionProgress) => void
): Promise<BatchProductionResult> {
  const { config, projectId, userId, settings } = request;

  const progress: BatchProductionProgress = {
    type: 'series',
    title: config.title,
    totalSegments: config.episodes.length,
    completedSegments: 0,
    overallProgress: 0,
    segmentResults: config.episodes.map(ep => ({
      segmentId: `episode-${ep.episodeNumber}`,
      title: `S${config.seasonNumber || 1}E${ep.episodeNumber}: ${ep.title}`,
      status: 'pending' as const,
    })),
    errors: [],
  };

  const videos: BatchProductionResult['videos'] = [];
  let totalCreditsUsed = 0;

  // Build character context for continuity
  const characterContext = config.mainCharacters
    ?.map(c => `${c.name} (${c.role}): ${c.description}`)
    .join('. ') || '';

  for (let i = 0; i < config.episodes.length; i++) {
    const episode = config.episodes[i];
    const segmentId = `episode-${episode.episodeNumber}`;

    // Update progress
    progress.currentSegment = `Episode ${episode.episodeNumber}: ${episode.title}`;
    progress.segmentResults[i].status = 'processing';
    progress.overallProgress = Math.round((i / config.episodes.length) * 100);
    onProgress?.(progress);

    // Build episode prompt with continuity context
    const episodePrompt = buildEpisodePrompt(
      episode,
      config,
      characterContext,
      i === 0, // isFirstEpisode
      i === config.episodes.length - 1 // isLastEpisode
    );

    try {
      const result = await produceEpisode({
        projectId,
        userId,
        prompt: episodePrompt,
        scenes: episode.scenes,
        title: episode.title,
        genre: config.genre,
        targetDuration: config.episodeDuration,
        settings,
      });

      if (result.success && result.videoUrl) {
        progress.segmentResults[i].status = 'completed';
        progress.segmentResults[i].videoUrl = result.videoUrl;
        videos.push({
          segmentId,
          title: `S${config.seasonNumber || 1}E${episode.episodeNumber}: ${episode.title}`,
          videoUrl: result.videoUrl,
          duration: result.duration || config.episodeDuration,
        });
        totalCreditsUsed += result.creditsUsed;
      } else {
        progress.segmentResults[i].status = 'failed';
        progress.segmentResults[i].error = result.error;
        progress.errors.push(`Episode ${episode.episodeNumber} failed: ${result.error}`);
      }
    } catch (error) {
      progress.segmentResults[i].status = 'failed';
      progress.segmentResults[i].error = error instanceof Error ? error.message : 'Unknown error';
      progress.errors.push(`Episode ${episode.episodeNumber} failed: ${error}`);
    }

    progress.completedSegments++;
    onProgress?.(progress);
  }

  progress.overallProgress = 100;
  onProgress?.(progress);

  const totalDuration = videos.reduce((acc, v) => acc + v.duration, 0);

  return {
    success: videos.length > 0,
    type: 'series',
    title: config.title,
    videos,
    totalDuration,
    totalCreditsUsed,
    progress,
    error: videos.length === 0 ? 'No episodes were successfully produced' : undefined,
  };
}

// ============================================================================
// Movie Production
// ============================================================================

/**
 * Produce a full movie (broken into acts).
 */
export async function produceMovie(
  request: MovieProductionRequest,
  onProgress?: (progress: BatchProductionProgress) => void
): Promise<BatchProductionResult> {
  const { config, projectId, userId, settings } = request;

  // Default to 3-act structure if not specified
  const acts = config.acts.length > 0 ? config.acts : generateDefaultActs(config);

  const progress: BatchProductionProgress = {
    type: 'movie',
    title: config.title,
    totalSegments: acts.length,
    completedSegments: 0,
    overallProgress: 0,
    segmentResults: acts.map(act => ({
      segmentId: `act-${act.actNumber}`,
      title: `Act ${act.actNumber}: ${act.title}`,
      status: 'pending' as const,
    })),
    errors: [],
  };

  const videos: BatchProductionResult['videos'] = [];
  let totalCreditsUsed = 0;

  // Build character context for continuity
  const characterContext = config.mainCharacters
    ?.map(c => `${c.name} (${c.role}): ${c.description}`)
    .join('. ') || '';

  for (let i = 0; i < acts.length; i++) {
    const act = acts[i];
    const segmentId = `act-${act.actNumber}`;

    // Update progress
    progress.currentSegment = `Act ${act.actNumber}: ${act.title}`;
    progress.segmentResults[i].status = 'processing';
    progress.overallProgress = Math.round((i / acts.length) * 100);
    onProgress?.(progress);

    // Build act prompt with movie context
    const actPrompt = buildActPrompt(
      act,
      config,
      characterContext,
      i === 0, // isFirstAct
      i === acts.length - 1 // isLastAct
    );

    try {
      const result = await produceEpisode({
        projectId,
        userId,
        prompt: actPrompt,
        scenes: act.scenes,
        title: `${config.title} - Act ${act.actNumber}`,
        genre: config.genre,
        targetDuration: act.duration * 60, // Convert minutes to seconds
        settings,
      });

      if (result.success && result.videoUrl) {
        progress.segmentResults[i].status = 'completed';
        progress.segmentResults[i].videoUrl = result.videoUrl;
        videos.push({
          segmentId,
          title: `Act ${act.actNumber}: ${act.title}`,
          videoUrl: result.videoUrl,
          duration: result.duration || act.duration * 60,
        });
        totalCreditsUsed += result.creditsUsed;
      } else {
        progress.segmentResults[i].status = 'failed';
        progress.segmentResults[i].error = result.error;
        progress.errors.push(`Act ${act.actNumber} failed: ${result.error}`);
      }
    } catch (error) {
      progress.segmentResults[i].status = 'failed';
      progress.segmentResults[i].error = error instanceof Error ? error.message : 'Unknown error';
      progress.errors.push(`Act ${act.actNumber} failed: ${error}`);
    }

    progress.completedSegments++;
    onProgress?.(progress);
  }

  progress.overallProgress = 100;
  onProgress?.(progress);

  const totalDuration = videos.reduce((acc, v) => acc + v.duration, 0);

  return {
    success: videos.length > 0,
    type: 'movie',
    title: config.title,
    videos,
    totalDuration,
    totalCreditsUsed,
    progress,
    error: videos.length === 0 ? 'No acts were successfully produced' : undefined,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildEpisodePrompt(
  episode: EpisodeConfig,
  series: SeriesConfig,
  characterContext: string,
  isFirstEpisode: boolean,
  isLastEpisode: boolean
): string {
  const parts: string[] = [];

  // Series context
  parts.push(`${series.genre} TV series: "${series.title}"`);
  if (series.setting) parts.push(`Setting: ${series.setting}`);

  // Episode specifics
  parts.push(`Episode ${episode.episodeNumber}: "${episode.title}"`);
  parts.push(episode.synopsis);

  // Character context
  if (characterContext) {
    parts.push(`Characters: ${characterContext}`);
  }

  // Plot points
  if (episode.plotPoints && episode.plotPoints.length > 0) {
    parts.push(`Key moments: ${episode.plotPoints.join(', ')}`);
  }

  // Position context
  if (isFirstEpisode) {
    parts.push('This is the series premiere - establish the world and characters');
  } else if (isLastEpisode) {
    parts.push('This is the season finale - resolve major plot threads');
  }

  // Overarching plot
  if (series.overarchingPlot) {
    parts.push(`Series arc: ${series.overarchingPlot}`);
  }

  return parts.join('. ');
}

function buildActPrompt(
  act: ActConfig,
  movie: MovieConfig,
  characterContext: string,
  isFirstAct: boolean,
  isLastAct: boolean
): string {
  const parts: string[] = [];

  // Movie context
  parts.push(`${movie.genre} film: "${movie.title}"`);
  if (movie.setting) parts.push(`Setting: ${movie.setting}`);

  // Act specifics
  parts.push(`Act ${act.actNumber}: "${act.title}"`);
  parts.push(act.synopsis);

  // Character context
  if (characterContext) {
    parts.push(`Characters: ${characterContext}`);
  }

  // Plot points
  if (act.plotPoints && act.plotPoints.length > 0) {
    parts.push(`Key moments: ${act.plotPoints.join(', ')}`);
  }

  // Three-act structure guidance
  if (isFirstAct) {
    parts.push('Act 1 - Setup: Establish the world, introduce characters, present the inciting incident');
  } else if (isLastAct) {
    parts.push('Act 3 - Resolution: Climax and resolution, character arcs complete');
  } else {
    parts.push('Act 2 - Confrontation: Rising action, obstacles, character development');
  }

  return parts.join('. ');
}

function generateDefaultActs(config: MovieConfig): ActConfig[] {
  const totalMinutes = config.targetDuration;

  return [
    {
      actNumber: 1,
      title: 'Setup',
      synopsis: `Opening of "${config.title}". ${config.synopsis} Establish the world and introduce the main characters.`,
      duration: Math.round(totalMinutes * 0.25), // 25% of movie
    },
    {
      actNumber: 2,
      title: 'Confrontation',
      synopsis: `Middle section of "${config.title}". Rising action, challenges, and character development.`,
      duration: Math.round(totalMinutes * 0.5), // 50% of movie
    },
    {
      actNumber: 3,
      title: 'Resolution',
      synopsis: `Climax and ending of "${config.title}". Final confrontation and resolution.`,
      duration: Math.round(totalMinutes * 0.25), // 25% of movie
    },
  ];
}

// ============================================================================
// Quick Production Helpers
// ============================================================================

/**
 * Quick series production from a simple prompt.
 */
export async function quickSeries(
  projectId: string,
  userId: string,
  title: string,
  synopsis: string,
  episodeCount: number = 6,
  episodeDuration: number = 60, // 1 minute per episode
  genre: string = 'drama'
): Promise<BatchProductionResult> {
  const episodes: EpisodeConfig[] = [];

  for (let i = 1; i <= episodeCount; i++) {
    episodes.push({
      episodeNumber: i,
      title: `Episode ${i}`,
      synopsis: i === 1
        ? `Pilot: ${synopsis}`
        : i === episodeCount
          ? `Finale: Conclusion of ${title}`
          : `Chapter ${i} of ${title}`,
    });
  }

  return produceSeries({
    projectId,
    userId,
    type: 'series',
    config: {
      title,
      genre,
      synopsis,
      episodeCount,
      episodeDuration,
      episodes,
    },
  });
}

/**
 * Quick movie production from a simple prompt.
 */
export async function quickMovie(
  projectId: string,
  userId: string,
  title: string,
  synopsis: string,
  targetDuration: number = 5, // 5 minutes default (for demo)
  genre: string = 'drama'
): Promise<BatchProductionResult> {
  return produceMovie({
    projectId,
    userId,
    type: 'movie',
    config: {
      title,
      genre,
      synopsis,
      targetDuration,
      acts: [], // Will use default 3-act structure
    },
  });
}

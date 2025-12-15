/**
 * Chapters API
 *
 * Handles chapter management for literary works projects.
 *
 * GET: List all chapters for a project
 * POST: Create a new chapter
 *
 * IMPORTANT: Chapter management is available to ALL tiers as part of
 * literary works support. Users can write novels and manuscripts
 * without ever touching StoryForge.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { dbGetProjectById } from '@/utils/db';
import {
  dbCreateChapter,
  dbGetProjectChapters,
} from '@/utils/db-literary';
import { getUserTierInfo, checkLiteraryWorksLimits } from '@/utils/tier-gating';
import type { Chapter } from '@/types/literary';

interface ChaptersResponse {
  chapters: Chapter[];
  totalWordCount: number;
}

interface CreateChapterResponse {
  chapter: Chapter;
}

interface ErrorResponse {
  error: string;
  message?: string;
  chaptersRemaining?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChaptersResponse | CreateChapterResponse | ErrorResponse>
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
    // List all chapters
    const chapters = await dbGetProjectChapters(projectId);
    const totalWordCount = chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0);

    return res.status(200).json({
      chapters,
      totalWordCount,
    });
  }

  if (req.method === 'POST') {
    const { title, content } = req.body as { title?: string; content?: string };

    if (!title) {
      return res.status(400).json({ error: 'Chapter title is required' });
    }

    // Get current chapters to determine number and check limits
    const existingChapters = await dbGetProjectChapters(projectId);
    const nextNumber = existingChapters.length + 1;

    // Check chapter limits
    const wordCount = content ? content.split(/\s+/).length : 0;
    const limits = checkLiteraryWorksLimits(
      tierInfo.tier,
      existingChapters.length,
      wordCount
    );

    if (!limits.canAddChapter) {
      return res.status(403).json({
        error: 'Chapter limit reached',
        message: `Your ${tierInfo.tier} plan allows up to ${existingChapters.length} chapters. Upgrade for more.`,
        chaptersRemaining: limits.chaptersRemaining,
      });
    }

    // Create the chapter
    const chapter = await dbCreateChapter(projectId, title, nextNumber, content);

    if (!chapter) {
      return res.status(500).json({ error: 'Failed to create chapter' });
    }

    return res.status(201).json({ chapter });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

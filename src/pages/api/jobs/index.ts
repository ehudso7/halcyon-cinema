import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { getUserJobs, Job, JobStatus, JobType } from '@/utils/job-queue';

interface JobsResponse {
  jobs?: Job[];
  error?: string;
}

const VALID_STATUSES: JobStatus[] = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
const VALID_TYPES: JobType[] = ['image_generation', 'video_generation', 'music_generation', 'story_expansion'];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<JobsResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  try {
    const { status, type, limit } = req.query;

    // Validate status parameter
    let validatedStatus: JobStatus | undefined;
    if (status && typeof status === 'string') {
      if (VALID_STATUSES.includes(status as JobStatus)) {
        validatedStatus = status as JobStatus;
      } else {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        });
      }
    }

    // Validate type parameter
    let validatedType: JobType | undefined;
    if (type && typeof type === 'string') {
      if (VALID_TYPES.includes(type as JobType)) {
        validatedType = type as JobType;
      } else {
        return res.status(400).json({
          error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
        });
      }
    }

    // Validate limit parameter
    let validatedLimit = 50;
    if (limit && typeof limit === 'string') {
      const parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return res.status(400).json({ error: 'Limit must be between 1 and 100' });
      }
      validatedLimit = parsedLimit;
    }

    const jobs = await getUserJobs(userId, {
      status: validatedStatus,
      type: validatedType,
      limit: validatedLimit,
    });

    return res.status(200).json({ jobs });
  } catch (error) {
    console.error('[jobs] Error getting jobs:', error);
    return res.status(500).json({ error: 'Failed to get jobs' });
  }
}

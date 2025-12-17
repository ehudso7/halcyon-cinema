import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, requireAuthWithCSRF } from '@/utils/api-auth';
import { getJob, cancelJob, Job } from '@/utils/job-queue';

interface JobResponse {
  job?: Job;
  error?: string;
  cancelled?: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<JobResponse>
) {
  const { jobId } = req.query;

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(jobId)) {
    return res.status(400).json({ error: 'Invalid job ID format' });
  }

  if (req.method === 'GET') {
    // Get job status - authentication only (no CSRF needed for GET)
    const userId = await requireAuth(req, res);
    if (!userId) return;

    try {
      const job = await getJob(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Verify ownership
      if (job.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.status(200).json({ job });
    } catch (error) {
      console.error('[jobs/[jobId]] Error getting job:', error);
      return res.status(500).json({ error: 'Failed to get job status' });
    }
  } else if (req.method === 'DELETE') {
    // Cancel job - requires CSRF protection for state-changing operation
    const userId = await requireAuthWithCSRF(req, res);
    if (!userId) return;

    try {
      const job = await getJob(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Verify ownership
      if (job.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const cancelled = await cancelJob(jobId);

      if (!cancelled) {
        return res.status(400).json({ error: 'Job cannot be cancelled (may already be completed)' });
      }

      return res.status(200).json({ cancelled: true });
    } catch (error) {
      console.error('[jobs/[jobId]] Error cancelling job:', error);
      return res.status(500).json({ error: 'Failed to cancel job' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

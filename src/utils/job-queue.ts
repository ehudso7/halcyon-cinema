import { query } from './db';

// Job status types
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type JobType = 'image_generation' | 'video_generation' | 'music_generation' | 'story_expansion';

// Job priority levels
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';
const PRIORITY_VALUES: Record<JobPriority, number> = {
  low: 1,
  normal: 5,
  high: 10,
  urgent: 20,
};

// Job interface
export interface Job<T = Record<string, unknown>> {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  userId: string;
  payload: T;
  result?: Record<string, unknown>;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  scheduledFor?: string;
}

// Job creation options
export interface CreateJobOptions<T = Record<string, unknown>> {
  type: JobType;
  userId: string;
  payload: T;
  priority?: JobPriority;
  maxAttempts?: number;
  scheduledFor?: Date;
}

/**
 * Create the jobs table if it doesn't exist
 */
export async function initializeJobQueue(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      priority INTEGER NOT NULL DEFAULT 5,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payload JSONB NOT NULL DEFAULT '{}',
      result JSONB,
      error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      scheduled_for TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
    )
  `);

  // Create indexes for efficient job queue queries
  await query('CREATE INDEX IF NOT EXISTS idx_jobs_status_priority ON jobs(status, priority DESC, scheduled_for ASC) WHERE status = \'pending\'');
  await query('CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs(user_id, status, created_at DESC)');
  await query('CREATE INDEX IF NOT EXISTS idx_jobs_type_status ON jobs(type, status)');
}

/**
 * Create a new job in the queue
 */
export async function createJob<T = Record<string, unknown>>(
  options: CreateJobOptions<T>
): Promise<Job<T>> {
  const {
    type,
    userId,
    payload,
    priority = 'normal',
    maxAttempts = 3,
    scheduledFor,
  } = options;

  const result = await query<Job<T>>(`
    INSERT INTO jobs (type, user_id, payload, priority, max_attempts, scheduled_for)
    VALUES ($1, $2::uuid, $3::jsonb, $4, $5, $6)
    RETURNING
      id,
      type,
      status,
      priority::text as priority,
      user_id as "userId",
      payload,
      result,
      error,
      attempts,
      max_attempts as "maxAttempts",
      created_at as "createdAt",
      started_at as "startedAt",
      completed_at as "completedAt",
      scheduled_for as "scheduledFor"
  `, [
    type,
    userId,
    JSON.stringify(payload),
    PRIORITY_VALUES[priority],
    maxAttempts,
    scheduledFor?.toISOString() || new Date().toISOString(),
  ]);

  if (!result.rows[0]) {
    throw new Error('Failed to create job');
  }

  // Convert priority number back to string
  const job = result.rows[0];
  job.priority = Object.entries(PRIORITY_VALUES).find(
    ([, v]) => v === Number(job.priority)
  )?.[0] as JobPriority || 'normal';

  return job;
}

/**
 * Get a job by ID
 */
export async function getJob<T = Record<string, unknown>>(jobId: string): Promise<Job<T> | null> {
  const result = await query<Job<T>>(`
    SELECT
      id,
      type,
      status,
      priority,
      user_id as "userId",
      payload,
      result,
      error,
      attempts,
      max_attempts as "maxAttempts",
      created_at as "createdAt",
      started_at as "startedAt",
      completed_at as "completedAt",
      scheduled_for as "scheduledFor"
    FROM jobs
    WHERE id = $1::uuid
  `, [jobId]);

  if (!result.rows[0]) {
    return null;
  }

  const job = result.rows[0];
  job.priority = Object.entries(PRIORITY_VALUES).find(
    ([, v]) => v === Number(job.priority)
  )?.[0] as JobPriority || 'normal';

  return job;
}

/**
 * Get jobs for a user
 */
export async function getUserJobs<T = Record<string, unknown>>(
  userId: string,
  options: { status?: JobStatus; type?: JobType; limit?: number } = {}
): Promise<Job<T>[]> {
  const { status, type, limit = 50 } = options;

  let queryStr = `
    SELECT
      id,
      type,
      status,
      priority,
      user_id as "userId",
      payload,
      result,
      error,
      attempts,
      max_attempts as "maxAttempts",
      created_at as "createdAt",
      started_at as "startedAt",
      completed_at as "completedAt",
      scheduled_for as "scheduledFor"
    FROM jobs
    WHERE user_id = $1::uuid
  `;
  const params: (string | number)[] = [userId];

  if (status) {
    params.push(status);
    queryStr += ` AND status = $${params.length}`;
  }

  if (type) {
    params.push(type);
    queryStr += ` AND type = $${params.length}`;
  }

  params.push(limit);
  queryStr += ` ORDER BY created_at DESC LIMIT $${params.length}`;

  const result = await query<Job<T>>(queryStr, params);

  return result.rows.map(job => ({
    ...job,
    priority: Object.entries(PRIORITY_VALUES).find(
      ([, v]) => v === Number(job.priority)
    )?.[0] as JobPriority || 'normal',
  }));
}

/**
 * Claim the next pending job for processing
 * Uses SELECT FOR UPDATE SKIP LOCKED for safe concurrent access
 */
export async function claimNextJob<T = Record<string, unknown>>(
  types?: JobType[]
): Promise<Job<T> | null> {
  let typeFilter = '';
  const params: string[] = [];

  if (types && types.length > 0) {
    params.push(...types);
    typeFilter = `AND type IN (${types.map((_, i) => `$${i + 1}`).join(', ')})`;
  }

  const result = await query<Job<T>>(`
    UPDATE jobs
    SET
      status = 'processing',
      started_at = NOW(),
      attempts = attempts + 1
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'pending'
        AND scheduled_for <= NOW()
        AND attempts < max_attempts
        ${typeFilter}
      ORDER BY priority DESC, scheduled_for ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING
      id,
      type,
      status,
      priority,
      user_id as "userId",
      payload,
      result,
      error,
      attempts,
      max_attempts as "maxAttempts",
      created_at as "createdAt",
      started_at as "startedAt",
      completed_at as "completedAt",
      scheduled_for as "scheduledFor"
  `, params);

  if (!result.rows[0]) {
    return null;
  }

  const job = result.rows[0];
  job.priority = Object.entries(PRIORITY_VALUES).find(
    ([, v]) => v === Number(job.priority)
  )?.[0] as JobPriority || 'normal';

  return job;
}

/**
 * Mark a job as completed with result
 */
export async function completeJob(
  jobId: string,
  result: Record<string, unknown>
): Promise<void> {
  await query(`
    UPDATE jobs
    SET
      status = 'completed',
      result = $2::jsonb,
      completed_at = NOW()
    WHERE id = $1::uuid
  `, [jobId, JSON.stringify(result)]);
}

/**
 * Mark a job as failed with error
 */
export async function failJob(
  jobId: string,
  error: string,
  retry: boolean = true
): Promise<void> {
  if (retry) {
    // Reset to pending for retry if attempts remaining
    await query(`
      UPDATE jobs
      SET
        status = CASE
          WHEN attempts < max_attempts THEN 'pending'
          ELSE 'failed'
        END,
        error = $2,
        started_at = NULL
      WHERE id = $1::uuid
    `, [jobId, error]);
  } else {
    // Mark as permanently failed
    await query(`
      UPDATE jobs
      SET
        status = 'failed',
        error = $2,
        completed_at = NOW()
      WHERE id = $1::uuid
    `, [jobId, error]);
  }
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  const result = await query(`
    UPDATE jobs
    SET status = 'cancelled', completed_at = NOW()
    WHERE id = $1::uuid AND status IN ('pending', 'processing')
    RETURNING id
  `, [jobId]);

  return (result.rowCount ?? 0) > 0;
}

/**
 * Clean up old completed/failed jobs
 */
export async function cleanupOldJobs(daysOld: number = 30): Promise<number> {
  const result = await query(`
    DELETE FROM jobs
    WHERE status IN ('completed', 'failed', 'cancelled')
      AND completed_at < NOW() - INTERVAL '1 day' * $1
  `, [daysOld]);

  return result.rowCount ?? 0;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  byType: Record<JobType, { pending: number; processing: number }>;
}> {
  const statusResult = await query<{ status: string; count: string }>(`
    SELECT status, COUNT(*) as count
    FROM jobs
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY status
  `);

  const typeResult = await query<{ type: string; status: string; count: string }>(`
    SELECT type, status, COUNT(*) as count
    FROM jobs
    WHERE status IN ('pending', 'processing')
    GROUP BY type, status
  `);

  const stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    byType: {} as Record<JobType, { pending: number; processing: number }>,
  };

  for (const row of statusResult.rows) {
    const status = row.status;
    const count = parseInt(row.count, 10);
    if (status === 'pending') stats.pending = count;
    else if (status === 'processing') stats.processing = count;
    else if (status === 'completed') stats.completed = count;
    else if (status === 'failed') stats.failed = count;
  }

  for (const row of typeResult.rows) {
    const type = row.type as JobType;
    if (!stats.byType[type]) {
      stats.byType[type] = { pending: 0, processing: 0 };
    }
    if (row.status === 'pending') {
      stats.byType[type].pending = parseInt(row.count, 10);
    } else if (row.status === 'processing') {
      stats.byType[type].processing = parseInt(row.count, 10);
    }
  }

  return stats;
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCSRF } from './useCSRF';

// Match server-side types
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type JobType = 'image_generation' | 'video_generation' | 'music_generation' | 'story_expansion';

export interface Job<T = Record<string, unknown>> {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: string;
  userId: string;
  payload: T;
  result?: Record<string, unknown>;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface UseJobQueueOptions {
  /** Polling interval in milliseconds (default: 2000) */
  pollInterval?: number;
  /** Maximum polling duration in milliseconds (default: 300000 = 5 minutes) */
  maxPollDuration?: number;
  /** Callback when job completes */
  onComplete?: (job: Job) => void;
  /** Callback when job fails */
  onFail?: (job: Job) => void;
}

interface UseJobQueueReturn {
  /** Current job being tracked */
  job: Job | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Start polling a job */
  pollJob: (jobId: string) => void;
  /** Stop polling */
  stopPolling: () => void;
  /** Cancel a job */
  cancelJob: (jobId: string) => Promise<boolean>;
  /** Get user's jobs */
  fetchJobs: (options?: { status?: JobStatus; type?: JobType; limit?: number }) => Promise<Job[]>;
}

/**
 * Hook for interacting with the job queue system
 */
export function useJobQueue(options: UseJobQueueOptions = {}): UseJobQueueReturn {
  const {
    pollInterval = 2000,
    maxPollDuration = 300000,
    onComplete,
    onFail,
  } = options;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { csrfFetch } = useCSRF();

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    startTimeRef.current = null;
    activeJobIdRef.current = null;
  }, []);

  const fetchJobStatus = useCallback(async (jobId: string): Promise<Job | null> => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch job status');
      }

      const data = await response.json();
      return data.job;
    } catch (err) {
      console.error('[useJobQueue] Error fetching job:', err);
      return null;
    }
  }, []);

  const pollJob = useCallback((jobId: string) => {
    // Stop any existing polling
    stopPolling();

    setLoading(true);
    setError(null);
    startTimeRef.current = Date.now();
    activeJobIdRef.current = jobId;

    const poll = async () => {
      // Check if we should stop polling
      if (activeJobIdRef.current !== jobId) {
        return;
      }

      // Check timeout
      if (startTimeRef.current && Date.now() - startTimeRef.current > maxPollDuration) {
        setError('Job polling timed out');
        setLoading(false);
        stopPolling();
        return;
      }

      const fetchedJob = await fetchJobStatus(jobId);

      if (!fetchedJob) {
        setError('Job not found');
        setLoading(false);
        stopPolling();
        return;
      }

      setJob(fetchedJob);

      // Check terminal states
      if (fetchedJob.status === 'completed') {
        setLoading(false);
        stopPolling();
        onComplete?.(fetchedJob);
        return;
      }

      if (fetchedJob.status === 'failed' || fetchedJob.status === 'cancelled') {
        setLoading(false);
        setError(fetchedJob.error || 'Job failed');
        stopPolling();
        onFail?.(fetchedJob);
        return;
      }

      // Continue polling
      pollTimeoutRef.current = setTimeout(poll, pollInterval);
    };

    // Start polling
    poll();
  }, [fetchJobStatus, maxPollDuration, onComplete, onFail, pollInterval, stopPolling]);

  const cancelJob = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const response = await csrfFetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel job');
      }

      // Stop polling if this is the active job
      if (activeJobIdRef.current === jobId) {
        stopPolling();
      }

      return true;
    } catch (err) {
      console.error('[useJobQueue] Error cancelling job:', err);
      return false;
    }
  }, [csrfFetch, stopPolling]);

  const fetchJobs = useCallback(async (
    fetchOptions: { status?: JobStatus; type?: JobType; limit?: number } = {}
  ): Promise<Job[]> => {
    try {
      const params = new URLSearchParams();
      if (fetchOptions.status) params.set('status', fetchOptions.status);
      if (fetchOptions.type) params.set('type', fetchOptions.type);
      if (fetchOptions.limit) params.set('limit', fetchOptions.limit.toString());

      const url = `/api/jobs${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch jobs');
      }

      const data = await response.json();
      return data.jobs || [];
    } catch (err) {
      console.error('[useJobQueue] Error fetching jobs:', err);
      return [];
    }
  }, []);

  return {
    job,
    loading,
    error,
    pollJob,
    stopPolling,
    cancelJob,
    fetchJobs,
  };
}

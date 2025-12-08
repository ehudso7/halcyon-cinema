import type { NextApiRequest, NextApiResponse } from 'next';
import { isPostgresAvailable } from '@/utils/db';
import { sql } from '@vercel/postgres';

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: {
      status: 'up' | 'down' | 'not_configured';
      type: 'postgres' | 'file';
      latencyMs?: number;
      error?: string;
      postgresUrlConfigured?: boolean;
    };
    auth: {
      status: 'configured' | 'not_configured';
    };
    api: {
      status: 'up';
    };
  };
  uptime: number;
  environment?: string;
}

const startTime = Date.now();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthCheckResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }

  const usePostgres = isPostgresAvailable();
  const authConfigured = !!process.env.NEXTAUTH_SECRET;
  let dbStatus: 'up' | 'down' | 'not_configured' = 'not_configured';
  let dbLatencyMs: number | undefined;
  let dbError: string | undefined;
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Log environment check for debugging
  console.log('[health] POSTGRES_URL configured:', usePostgres);
  console.log('[health] NEXTAUTH_SECRET configured:', authConfigured);
  console.log('[health] NODE_ENV:', process.env.NODE_ENV);

  // Actually test database connectivity if Postgres is configured
  if (usePostgres) {
    const dbStartTime = Date.now();
    try {
      await sql`SELECT 1`;
      dbStatus = 'up';
      dbLatencyMs = Date.now() - dbStartTime;
      console.log('[health] Database connection successful, latency:', dbLatencyMs, 'ms');
    } catch (error) {
      console.error('[health] Database connection check failed:', error);
      dbStatus = 'down';
      overallStatus = 'unhealthy';
      // Capture error message for diagnostics (safe to expose since it's server-side config issue)
      if (error instanceof Error) {
        dbError = error.message;
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Degraded if no Postgres configured in production
    overallStatus = 'degraded';
    console.warn('[health] POSTGRES_URL not configured in production environment');
  }

  // Auth is critical for user operations
  if (!authConfigured) {
    overallStatus = process.env.NODE_ENV === 'production' ? 'unhealthy' : 'degraded';
  }

  const healthCheck: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: {
        status: dbStatus,
        type: usePostgres ? 'postgres' : 'file',
        postgresUrlConfigured: usePostgres,
        ...(dbLatencyMs !== undefined && { latencyMs: dbLatencyMs }),
        ...(dbError !== undefined && { error: dbError }),
      },
      auth: {
        status: authConfigured ? 'configured' : 'not_configured',
      },
      api: {
        status: 'up',
      },
    },
    uptime: Math.floor((Date.now() - startTime) / 1000),
    environment: process.env.NODE_ENV || 'development',
  };

  // Set cache headers
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  // Return 200 for healthy/degraded, 503 only for unhealthy
  const statusCode = healthCheck.status === 'unhealthy' ? 503 : 200;
  return res.status(statusCode).json(healthCheck);
}

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
    };
    auth: {
      status: 'configured' | 'not_configured';
    };
    api: {
      status: 'up';
    };
  };
  uptime: number;
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
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Actually test database connectivity if Postgres is configured
  if (usePostgres) {
    const dbStartTime = Date.now();
    try {
      await sql`SELECT 1`;
      dbStatus = 'up';
      dbLatencyMs = Date.now() - dbStartTime;
    } catch (error) {
      console.error('[health] Database connection check failed:', error);
      dbStatus = 'down';
      overallStatus = 'unhealthy';
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Degraded if no Postgres configured in production
    overallStatus = 'degraded';
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
        ...(dbLatencyMs !== undefined && { latencyMs: dbLatencyMs }),
      },
      auth: {
        status: authConfigured ? 'configured' : 'not_configured',
      },
      api: {
        status: 'up',
      },
    },
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  // Set cache headers
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  // Return 200 for healthy/degraded, 503 only for unhealthy
  const statusCode = healthCheck.status === 'unhealthy' ? 503 : 200;
  return res.status(statusCode).json(healthCheck);
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { isPostgresAvailable } from '@/utils/db';

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: {
      status: 'up' | 'down' | 'not_configured';
      type: 'postgres' | 'file';
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

  const healthCheck: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: {
        status: usePostgres ? 'up' : 'not_configured',
        type: usePostgres ? 'postgres' : 'file',
      },
      api: {
        status: 'up',
      },
    },
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  // Degraded if no Postgres in production
  if (!usePostgres && process.env.NODE_ENV === 'production') {
    healthCheck.status = 'degraded';
  }

  // Set cache headers
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  return res.status(healthCheck.status === 'healthy' ? 200 : 503).json(healthCheck);
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { isPostgresAvailable, testConnection } from '@/utils/db';
import { isSupabaseConfigured, isSupabaseAdminConfigured, getSupabaseUrl } from '@/utils/supabase';

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
    supabase: {
      status: 'configured' | 'partial' | 'not_configured';
      clientConfigured: boolean;
      adminConfigured: boolean;
      url?: string;
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

// Log configuration only once per cold start to avoid log noise
let configLoggedOnce = false;

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

  // Check Supabase configuration
  const supabaseClientConfigured = isSupabaseConfigured();
  const supabaseAdminConfigured = isSupabaseAdminConfigured();
  const supabaseUrl = getSupabaseUrl();

  // Log environment check only once per cold start to reduce log noise
  if (!configLoggedOnce) {
    console.log('[health] POSTGRES_URL configured:', usePostgres);
    console.log('[health] NEXTAUTH_SECRET configured:', authConfigured);
    console.log('[health] Supabase client configured:', supabaseClientConfigured);
    console.log('[health] Supabase admin configured:', supabaseAdminConfigured);
    console.log('[health] NODE_ENV:', process.env.NODE_ENV);
    configLoggedOnce = true;
  }

  // Actually test database connectivity if Postgres is configured
  if (usePostgres) {
    const dbStartTime = Date.now();
    try {
      await testConnection();
      dbStatus = 'up';
      dbLatencyMs = Date.now() - dbStartTime;
    } catch (error) {
      console.error('[health] Database connection check failed:', error);
      dbStatus = 'down';
      overallStatus = 'unhealthy';
      // In production, show generic error to avoid leaking infrastructure details
      // In development, show full error message for debugging
      if (process.env.NODE_ENV === 'production') {
        dbError = 'Connection failed';
      } else if (error instanceof Error) {
        dbError = error.message;
      } else {
        dbError = 'Unknown error';
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Degraded if no Postgres configured in production
    overallStatus = 'degraded';
  }

  // Auth is critical for user operations
  if (!authConfigured) {
    overallStatus = process.env.NODE_ENV === 'production' ? 'unhealthy' : 'degraded';
  }

  // Determine Supabase overall status
  let supabaseStatus: 'configured' | 'partial' | 'not_configured' = 'not_configured';
  if (supabaseClientConfigured && supabaseAdminConfigured) {
    supabaseStatus = 'configured';
  } else if (supabaseClientConfigured || supabaseAdminConfigured) {
    supabaseStatus = 'partial';
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
      supabase: {
        status: supabaseStatus,
        clientConfigured: supabaseClientConfigured,
        adminConfigured: supabaseAdminConfigured,
        ...(supabaseUrl && { url: supabaseUrl.replace(/^(https?:\/\/[^.]+).*/, '$1.***') }), // Mask URL for security
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

import type { NextApiRequest, NextApiResponse } from 'next';
import { timingSafeEqual } from 'crypto';
import { getSupabaseUrl, getSupabaseServiceRoleKey } from '@/utils/supabase';

interface HealthResponse {
  status: 'ok' | 'error';
  storage: {
    configured: boolean;
    supabaseUrl: string | null;
    serviceKeySet: boolean;
  };
  message: string;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Health check endpoint for image storage configuration.
 * Reports whether Supabase Storage is properly configured without exposing secrets.
 *
 * In production, this endpoint requires the X-Internal-Health-Token header
 * to match INTERNAL_HEALTH_TOKEN env var for security.
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  // Prevent caching of diagnostic payloads
  res.setHeader('Cache-Control', 'no-store');

  // Gate access in production to prevent information disclosure
  if (process.env.NODE_ENV === 'production') {
    const expectedToken = process.env.INTERNAL_HEALTH_TOKEN;
    const providedToken = req.headers['x-internal-health-token'];

    if (!expectedToken) {
      console.warn(
        'INTERNAL_HEALTH_TOKEN not configured in production - storage-health endpoint blocked'
      );
      return res.status(404).end();
    }

    // Use constant-time comparison to prevent timing attacks
    if (
      typeof providedToken !== 'string' ||
      !safeCompare(providedToken, expectedToken)
    ) {
      return res.status(404).end();
    }
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      status: 'error',
      storage: { configured: false, supabaseUrl: null, serviceKeySet: false },
      message: `Method ${req.method} not allowed`,
    });
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceKeySet = !!getSupabaseServiceRoleKey();
  let urlIsValid = false;

  // Mask the URL for privacy (show only the host)
  let maskedUrl: string | null = null;
  if (supabaseUrl) {
    try {
      const parsed = new URL(supabaseUrl);
      maskedUrl = parsed.host;
      urlIsValid = true;
    } catch {
      maskedUrl = '[invalid URL]';
    }
  }

  // Only consider configured if URL is valid AND service key is set
  const isConfigured = serviceKeySet && urlIsValid;

  const response: HealthResponse = {
    status: isConfigured ? 'ok' : 'error',
    storage: {
      configured: isConfigured,
      supabaseUrl: maskedUrl,
      serviceKeySet,
    },
    message: isConfigured
      ? 'Image storage is properly configured. Generated images will be permanently stored.'
      : 'Image storage is NOT configured. Missing: ' +
        (!supabaseUrl ? 'SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL ' : '') +
        (!urlIsValid && supabaseUrl ? 'valid SUPABASE_URL ' : '') +
        (!serviceKeySet ? 'SUPABASE_SERVICE_ROLE_KEY' : ''),
  };

  return res.status(isConfigured ? 200 : 503).json(response);
}

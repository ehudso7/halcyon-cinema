import type { NextApiRequest, NextApiResponse } from 'next';
import { isSupabaseAdminConfigured, getSupabaseUrl } from '@/utils/supabase';

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
 * Health check endpoint for image storage configuration.
 * Reports whether Supabase Storage is properly configured without exposing secrets.
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      status: 'error',
      storage: { configured: false, supabaseUrl: null, serviceKeySet: false },
      message: `Method ${req.method} not allowed`,
    });
  }

  const supabaseUrl = getSupabaseUrl();
  const isConfigured = isSupabaseAdminConfigured();
  const serviceKeySet = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Mask the URL for privacy (show only the host)
  let maskedUrl: string | null = null;
  if (supabaseUrl) {
    try {
      const parsed = new URL(supabaseUrl);
      maskedUrl = parsed.host;
    } catch {
      maskedUrl = '[invalid URL]';
    }
  }

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
        (!serviceKeySet ? 'SUPABASE_SERVICE_ROLE_KEY' : ''),
  };

  return res.status(isConfigured ? 200 : 503).json(response);
}

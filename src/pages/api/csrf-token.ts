import type { NextApiRequest, NextApiResponse } from 'next';
import { setCSRFCookie } from '@/utils/csrf';

interface CSRFTokenResponse {
  token: string;
}

/**
 * API endpoint to get a CSRF token
 * This sets a CSRF cookie and returns the token in the response body
 * The frontend should include this token in the x-csrf-token header for state-changing requests
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<CSRFTokenResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const token = setCSRFCookie(res);

    return res.status(200).json({ token });
  } catch (error) {
    console.error('[csrf-token] Error generating token:', error);
    return res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { requireCSRF } from './csrf';

export interface AuthenticatedRequest extends NextApiRequest {
  userId?: string;
}

/**
 * Validates that a request has a valid session.
 * Returns the user ID if authenticated, null otherwise.
 */
export async function getAuthenticatedUserId(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<string | null> {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return null;
  }

  return session.user.id;
}

/**
 * Middleware helper that requires authentication.
 * Returns 401 if not authenticated.
 */
export async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<string | null> {
  const userId = await getAuthenticatedUserId(req, res);

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  return userId;
}

/**
 * Middleware helper that requires both CSRF validation and authentication.
 * Use this for state-changing endpoints (POST, PUT, DELETE, PATCH).
 * Returns 403 if CSRF fails, 401 if not authenticated.
 */
export async function requireAuthWithCSRF(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<string | null> {
  // First validate CSRF for state-changing methods
  const csrfValid = await requireCSRF(req, res);
  if (!csrfValid) {
    return null;
  }

  // Then validate authentication
  return requireAuth(req, res);
}

/**
 * Simple rate limiter using in-memory storage.
 * Note: This is per-instance and will reset on server restart.
 * For production, use Redis or similar.
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Clean up old rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((value, key) => {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  });
}, 60000);

import type { NextApiRequest, NextApiResponse } from 'next';
import { createUser } from '@/utils/users';
import { ApiError, User } from '@/types';

// Literal string patterns for database connection issues (all lowercase for comparison)
const DB_LITERAL_PATTERNS = [
  'database not available',
  'connection refused',
  'econnrefused',
  'connection terminated',
  'connection timeout',
  'connection reset',
  'socket hang up',
  'etimedout',
  'enotfound',
  'getaddrinfo',
  'connect etimedout',
  'cannot connect',
  'failed to connect',
  'connection error',
  'connection failed',
  'no pg_hba.conf entry',
  'password authentication failed',
  'ssl required',
  'ssl connection',
  // SSL certificate verification errors
  'self signed certificate',
  'unable to verify',
  'certificate has expired',
  'cert_has_expired',
  'depth_zero_self_signed_cert',
  'unable_to_get_issuer_cert',
  'unable_to_verify_leaf_signature',
  'certificate chain',
] as const;

// Pre-compiled regex patterns for dynamic error messages (e.g., "role xyz does not exist")
// Note: These are matched against lowercase error messages, so no /i flag needed
const DB_REGEX_PATTERNS = [
  /role .* does not exist/,
  /database .* does not exist/,
] as const;

/**
 * Check if an error message indicates a database connection issue
 */
function isDbConnectionError(errorMsg: string): boolean {
  return (
    DB_LITERAL_PATTERNS.some(p => errorMsg.includes(p)) ||
    DB_REGEX_PATTERNS.some(r => r.test(errorMsg))
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ user: Omit<User, 'passwordHash'> } | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { email, password, name } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const user = await createUser(email, password, name);
    return res.status(201).json({ user });
  } catch (error) {
    if (error instanceof Error && error.message === 'User already exists') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Log detailed error for debugging (server-side only)
    console.error('Registration error:', error);

    // Provide helpful error message based on error type
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();

      if (isDbConnectionError(errorMsg)) {
        console.error('[register] Database connection error:', error.message);
        return res.status(503).json({
          error: 'Database service unavailable. Please try again later or contact support.',
          code: 'DB_UNAVAILABLE'
        });
      }

      // Check for configuration issues
      if (error.message.includes('POSTGRES_URL')) {
        console.error('[register] Database configuration error:', error.message);
        return res.status(503).json({
          error: 'Database not configured. Please check server configuration.',
          code: 'DB_NOT_CONFIGURED'
        });
      }
    }

    console.error('[register] Unexpected error:', error);
    return res.status(500).json({ error: 'Failed to create account' });
  }
}

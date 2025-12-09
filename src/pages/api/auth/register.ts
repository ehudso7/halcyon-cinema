import type { NextApiRequest, NextApiResponse } from 'next';
import { createUser } from '@/utils/users';
import { ApiError, User } from '@/types';
import { authLogger, generateRequestId } from '@/utils/logger';

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
  const requestId = generateRequestId();

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    authLogger.warn('Method not allowed', { requestId, method: req.method });
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { email, password, name } = req.body;

  authLogger.info('Registration attempt started', {
    requestId,
    email: email ? `${email.substring(0, 3)}***@***` : 'not provided',
    hasPassword: !!password,
    hasName: !!name,
  });

  if (!email || typeof email !== 'string') {
    authLogger.warn('Registration failed: missing email', { requestId });
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    authLogger.warn('Registration failed: invalid password', { requestId, passwordLength: password?.length ?? 0 });
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  if (!name || typeof name !== 'string') {
    authLogger.warn('Registration failed: missing name', { requestId });
    return res.status(400).json({ error: 'Name is required' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    authLogger.warn('Registration failed: invalid email format', { requestId });
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const timer = authLogger.startTimer('createUser', { requestId });

  try {
    const user = await createUser(email, password, name);
    timer.end({ userId: user.id });
    authLogger.info('Registration successful', { requestId, userId: user.id });
    return res.status(201).json({ user });
  } catch (error) {
    if (error instanceof Error && error.message === 'User already exists') {
      timer.end({ result: 'duplicate' });
      authLogger.info('Registration failed: duplicate email', { requestId });
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Provide helpful error message based on error type
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();

      // Build detailed error context
      const errorContext: Record<string, unknown> = {
        requestId,
        errorName: error.name,
        errorMessage: error.message,
      };

      if ('code' in error) {
        errorContext.errorCode = (error as { code: string }).code;
      }
      if ('detail' in error) {
        errorContext.errorDetail = (error as { detail: string }).detail;
      }
      if ('hint' in error) {
        errorContext.errorHint = (error as { hint: string }).hint;
      }

      if (isDbConnectionError(errorMsg)) {
        timer.error(error, { ...errorContext, errorType: 'DB_UNAVAILABLE' });
        return res.status(503).json({
          error: 'Database service unavailable. Please try again later or contact support.',
          code: 'DB_UNAVAILABLE'
        });
      }

      // Check for configuration issues
      if (error.message.includes('POSTGRES_URL') || error.message.includes('DATABASE_URL')) {
        timer.error(error, { ...errorContext, errorType: 'DB_NOT_CONFIGURED' });
        return res.status(503).json({
          error: 'Database not configured. Please check server configuration.',
          code: 'DB_NOT_CONFIGURED'
        });
      }

      timer.error(error, { ...errorContext, errorType: 'UNEXPECTED' });
    } else {
      timer.error(error, { requestId, errorType: 'UNKNOWN' });
    }

    return res.status(500).json({ error: 'Failed to create account' });
  }
}

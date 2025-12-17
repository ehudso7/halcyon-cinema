import { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes, createHmac } from 'crypto';

// CSRF token configuration
const CSRF_COOKIE_NAME = '__Host-csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Secret for HMAC signing - must be set in production
const CSRF_SECRET_ENV = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET;
if (!CSRF_SECRET_ENV && process.env.NODE_ENV === 'production') {
  throw new Error('CSRF_SECRET or NEXTAUTH_SECRET must be set in production');
}
const CSRF_SECRET = CSRF_SECRET_ENV || 'dev-only-csrf-secret-not-for-production';

interface CSRFTokenPayload {
  token: string;
  timestamp: number;
}

/**
 * Generate a cryptographically secure CSRF token with timestamp
 */
function generateToken(): string {
  const randomPart = randomBytes(TOKEN_LENGTH).toString('hex');
  const timestamp = Date.now();
  const payload: CSRFTokenPayload = { token: randomPart, timestamp };
  const payloadStr = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadStr).toString('base64url');

  // Create HMAC signature
  const signature = createHmac('sha256', CSRF_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verify a CSRF token's signature and expiry
 */
function verifyToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [payloadBase64, signature] = parts;

  // Verify signature using constant-time comparison
  const expectedSignature = createHmac('sha256', CSRF_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  if (!constantTimeEqual(signature, expectedSignature)) {
    return false;
  }

  // Verify expiry
  try {
    const payloadStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const payload: CSRFTokenPayload = JSON.parse(payloadStr);

    if (Date.now() - payload.timestamp > TOKEN_EXPIRY_MS) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Get CSRF token from request cookies
 */
function getTokenFromCookie(req: NextApiRequest): string | null {
  const cookies = req.cookies;
  return cookies[CSRF_COOKIE_NAME] || null;
}

/**
 * Get CSRF token from request header
 */
function getTokenFromHeader(req: NextApiRequest): string | null {
  const header = req.headers[CSRF_HEADER_NAME];
  if (Array.isArray(header)) {
    return header[0] || null;
  }
  return header || null;
}

/**
 * Set CSRF cookie on response
 */
export function setCSRFCookie(res: NextApiResponse): string {
  const token = generateToken();

  // Use __Host- prefix for enhanced security (requires Secure, path=/, no domain)
  // In development, we use a regular cookie name since __Host- requires HTTPS
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieName = isProduction ? CSRF_COOKIE_NAME : 'csrf-token';

  const cookieOptions = [
    `${cookieName}=${token}`,
    'Path=/',
    'SameSite=Strict',
    'HttpOnly',
    `Max-Age=${Math.floor(TOKEN_EXPIRY_MS / 1000)}`,
  ];

  if (isProduction) {
    cookieOptions.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieOptions.join('; '));

  return token;
}

/**
 * Validate CSRF token in request
 * Uses double-submit cookie pattern: token in cookie must match token in header
 */
export function validateCSRF(req: NextApiRequest): { valid: boolean; error?: string } {
  // Skip CSRF validation for GET, HEAD, OPTIONS requests (safe methods)
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method || '')) {
    return { valid: true };
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieName = isProduction ? CSRF_COOKIE_NAME : 'csrf-token';

  // Get token from cookie
  const cookieToken = req.cookies[cookieName];
  if (!cookieToken) {
    return { valid: false, error: 'CSRF cookie not found' };
  }

  // Get token from header
  const headerToken = getTokenFromHeader(req);
  if (!headerToken) {
    return { valid: false, error: 'CSRF header not found' };
  }

  // Verify cookie token signature and expiry
  if (!verifyToken(cookieToken)) {
    return { valid: false, error: 'Invalid or expired CSRF token' };
  }

  // Double-submit validation: cookie and header must match
  if (!constantTimeEqual(cookieToken, headerToken)) {
    return { valid: false, error: 'CSRF token mismatch' };
  }

  return { valid: true };
}

/**
 * CSRF protection middleware for API routes
 * Returns 403 if CSRF validation fails
 */
export async function requireCSRF(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<boolean> {
  const result = validateCSRF(req);

  if (!result.valid) {
    console.warn('[CSRF] Validation failed:', {
      method: req.method,
      url: req.url,
      error: result.error,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    res.status(403).json({
      error: 'CSRF validation failed',
      code: 'CSRF_INVALID',
    });
    return false;
  }

  return true;
}

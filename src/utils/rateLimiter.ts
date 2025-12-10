/**
 * Simple in-memory rate limiter for API routes
 * In production, use Redis or a distributed rate limiting service
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store - resets on server restart
// For production, use Redis or similar
const rateLimitStore = new Map<string, RateLimitEntry>();

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Deterministic cleanup interval (every 60 seconds)
// Note: This only runs in Node.js environments
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupExpiredEntries();
  }, 60 * 1000);
}

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

// Default configurations for different endpoints
export const RATE_LIMITS = {
  // Very strict for expensive AI generation
  imageGeneration: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 5,       // 5 generations per minute
  },
  // Moderate for standard API calls
  api: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 60,      // 60 requests per minute
  },
  // Strict for auth endpoints to prevent brute force
  auth: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 10,           // 10 attempts per 15 minutes
  },
  // Very strict for registration
  register: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 5,            // 5 registrations per hour per IP
  },
} as const;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number; // Seconds until rate limit resets
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = identifier;

  const entry = rateLimitStore.get(key);

  // No existing entry or expired window
  if (!entry || now >= entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter,
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get client identifier for rate limiting
 * Uses IP address or falls back to a generic identifier
 */
export function getClientIdentifier(
  req: { headers: { [key: string]: string | string[] | undefined }; socket?: { remoteAddress?: string } },
  endpoint: string
): string {
  // Try to get real IP from proxy headers
  const forwardedFor = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];

  let ip: string;

  if (typeof forwardedFor === 'string') {
    ip = forwardedFor.split(',')[0].trim();
  } else if (typeof realIp === 'string') {
    ip = realIp;
  } else if (req.socket?.remoteAddress) {
    ip = req.socket.remoteAddress;
  } else {
    ip = 'unknown';
  }

  // Combine IP with endpoint for separate rate limits per endpoint
  return `${ip}:${endpoint}`;
}

/**
 * Format rate limit headers for response
 * @param result - Rate limit check result
 * @param maxRequests - The maximum requests allowed in the window
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  maxRequests: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
    ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() }),
  };
}

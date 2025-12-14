/**
 * Newsletter subscription API endpoint.
 *
 * Handles newsletter subscriptions with email validation, source tracking,
 * and database persistence. Supports re-subscription for previously
 * unsubscribed users.
 *
 * @module api/newsletter/subscribe
 *
 * @example
 * ```typescript
 * // POST /api/newsletter/subscribe
 * const response = await fetch('/api/newsletter/subscribe', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     email: 'user@example.com',
 *     source: 'landing_page'
 *   })
 * });
 * ```
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { query, isPostgresAvailable } from '@/utils/db';

/**
 * Response structure for newsletter subscription requests.
 * @interface SubscribeResponse
 */
interface SubscribeResponse {
  /** Whether the subscription was successful */
  success: boolean;
  /** Success message (when subscription succeeds) */
  message?: string;
  /** Error message (when subscription fails) */
  error?: string;
}

/**
 * Valid source values for tracking where subscriptions originate.
 * Used to validate and sanitize the source parameter.
 * @constant
 */
const VALID_SOURCES = ['landing_page', 'footer', 'popup', 'settings'] as const;

/**
 * Initializes the newsletter subscribers table if it doesn't exist.
 *
 * Creates a table with:
 * - `id`: UUID primary key
 * - `email`: Unique email address (case-insensitive via LOWER())
 * - `subscribed_at`: Timestamp of subscription
 * - `unsubscribed_at`: Timestamp of unsubscription (null if active)
 * - `source`: Where the subscription originated
 *
 * @returns Promise that resolves when table is initialized
 * @internal
 */
async function initNewsletterTable(): Promise<void> {
  if (!isPostgresAvailable()) return;

  await query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      unsubscribed_at TIMESTAMP WITH TIME ZONE,
      source VARCHAR(50) DEFAULT 'landing_page'
    )
  `);
}

/**
 * Handles POST requests for newsletter subscriptions.
 *
 * Validates the email format, sanitizes the source parameter,
 * and stores the subscription in the database. If the email
 * already exists (previously unsubscribed), reactivates the subscription.
 *
 * @param req - Next.js API request object
 * @param res - Next.js API response object
 *
 * @example
 * ```typescript
 * // Success response (200)
 * { success: true, message: 'Successfully subscribed to the newsletter!' }
 *
 * // Validation error response (400)
 * { success: false, error: 'Invalid email format' }
 *
 * // Service unavailable response (503)
 * { success: false, error: 'Newsletter service temporarily unavailable' }
 * ```
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SubscribeResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    });
  }

  const { email, source } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email format'
    });
  }

  try {
    await initNewsletterTable();

    // Return 503 if database is unavailable (don't silently succeed)
    if (!isPostgresAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Newsletter service temporarily unavailable'
      });
    }

    // Validate and sanitize source parameter
    const sanitizedSource = typeof source === 'string' && VALID_SOURCES.includes(source as typeof VALID_SOURCES[number])
      ? source
      : 'landing_page';

    // Insert or update (re-subscribe if previously unsubscribed)
    await query(
      `INSERT INTO newsletter_subscribers (email, source)
       VALUES (LOWER($1), $2)
       ON CONFLICT (email)
       DO UPDATE SET unsubscribed_at = NULL, subscribed_at = NOW()`,
      [email, sanitizedSource]
    );

    return res.status(200).json({
      success: true,
      message: 'Successfully subscribed to the newsletter!'
    });
  } catch (error) {
    console.error('[newsletter] Subscription error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to subscribe. Please try again.'
    });
  }
}

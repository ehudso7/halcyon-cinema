import type { NextApiRequest, NextApiResponse } from 'next';
import { query, isPostgresAvailable } from '@/utils/db';

interface SubscribeResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Valid source values for newsletter subscriptions
const VALID_SOURCES = ['landing_page', 'footer', 'popup', 'settings'] as const;

// Initialize newsletter subscribers table
async function initNewsletterTable() {
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

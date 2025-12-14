import type { NextApiRequest, NextApiResponse } from 'next';
import { query, isPostgresAvailable } from '@/utils/db';

interface SubscribeResponse {
  success: boolean;
  message?: string;
  error?: string;
}

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

  await query(`
    CREATE INDEX IF NOT EXISTS idx_newsletter_email
    ON newsletter_subscribers(email)
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

    if (isPostgresAvailable()) {
      // Insert or update (re-subscribe if previously unsubscribed)
      await query(
        `INSERT INTO newsletter_subscribers (email, source)
         VALUES (LOWER($1), $2)
         ON CONFLICT (email)
         DO UPDATE SET unsubscribed_at = NULL, subscribed_at = NOW()`,
        [email, source || 'landing_page']
      );
    }

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

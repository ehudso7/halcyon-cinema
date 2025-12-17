import type { NextApiRequest, NextApiResponse } from 'next';
import { timingSafeEqual } from 'crypto';
import { getUserByEmail, updateUserSubscription, addCredits } from '@/utils/db';

// Admin secret must be configured via environment variable - no default fallback
const ADMIN_SECRET = process.env.ADMIN_SECRET;

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true if strings are equal, false otherwise.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  // Ensure both strings are the same length to prevent timing leaks
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// Credit allocations for each tier
const TIER_CREDITS = {
  starter: 100, // Starter tier
  pro: 500, // Creator tier
  enterprise: 2000, // Studio tier
} as const;

type SubscriptionTier = keyof typeof TIER_CREDITS;

interface GrantSubscriptionRequest {
  email: string;
  tier: SubscriptionTier;
  duration: 'monthly' | 'yearly';
  adminSecret: string;
}

// Simple email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if admin secret is configured
  if (!ADMIN_SECRET) {
    console.error('[admin/grant-subscription] ADMIN_SECRET environment variable not configured');
    return res.status(500).json({ error: 'Server misconfigured: admin functionality not available' });
  }

  try {
    const { email, tier, duration, adminSecret } = req.body as GrantSubscriptionRequest;

    // Validate admin secret using constant-time comparison to prevent timing attacks
    if (!constantTimeCompare(adminSecret, ADMIN_SECRET)) {
      return res.status(403).json({ error: 'Invalid admin secret' });
    }

    // Validate required fields
    if (!email || !tier || !duration) {
      return res.status(400).json({ error: 'Missing required fields: email, tier, duration' });
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate tier
    if (!['starter', 'pro', 'enterprise'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Must be: starter, pro, or enterprise' });
    }

    // Validate duration
    if (!['monthly', 'yearly'].includes(duration)) {
      return res.status(400).json({ error: 'Invalid duration. Must be: monthly or yearly' });
    }

    // Get user by email
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: `User not found with email: ${email}` });
    }

    // Calculate expiration date
    const expiresAt = new Date();
    if (duration === 'monthly') {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // Update user subscription
    const updatedUser = await updateUserSubscription(
      user.id,
      tier,
      expiresAt,
      `admin_grant_${Date.now()}` // Pseudo subscription ID for admin grants
    );

    if (!updatedUser) {
      return res.status(500).json({ error: 'Failed to update subscription' });
    }

    // Add credits for the subscription tier
    const creditsToAdd = TIER_CREDITS[tier];
    const referenceId = `admin_grant_${user.id}_${Date.now()}`;

    await addCredits(
      user.id,
      creditsToAdd,
      'bonus',
      `Admin granted ${tier} ${duration} subscription`,
      referenceId
    );

    return res.status(200).json({
      success: true,
      message: `Successfully granted ${tier} ${duration} subscription to ${email}`,
      user: {
        id: user.id,
        email: user.email,
        subscriptionTier: tier,
        subscriptionExpiresAt: expiresAt.toISOString(),
        creditsAdded: creditsToAdd,
      },
    });
  } catch (error) {
    console.error('[admin/grant-subscription] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

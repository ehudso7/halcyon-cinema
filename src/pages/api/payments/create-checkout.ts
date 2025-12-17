import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { requireCSRF } from '@/utils/csrf';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

interface CheckoutResponse {
  url?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CheckoutResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Require CSRF protection for payment operations
  const csrfValid = await requireCSRF(req, res);
  if (!csrfValid) return;

  if (!stripe) {
    return res.status(503).json({
      error: 'Payment processing is not configured. Please contact support.',
    });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { priceId, mode, credits } = req.body;

  if (!priceId || typeof priceId !== 'string') {
    return res.status(400).json({ error: 'Price ID is required' });
  }

  if (!mode || !['subscription', 'payment'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid checkout mode' });
  }

  try {
    // Create or get Stripe customer
    let customerId: string;

    // Check if user already has a Stripe customer ID
    const { getUserById } = await import('@/utils/db');
    const user = await getUserById(session.user.id);

    if (user && 'stripeCustomerId' in user && user.stripeCustomerId) {
      customerId = user.stripeCustomerId as string;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: session.user.email,
        metadata: {
          userId: session.user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to database
      const { query } = await import('@/utils/db');
      await query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2::uuid',
        [customerId, session.user.id]
      );
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: mode as Stripe.Checkout.SessionCreateParams.Mode,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: session.user.id,
        credits: credits?.toString() || '',
      },
      success_url: `${baseUrl}/settings?payment=success`,
      cancel_url: `${baseUrl}/pricing?payment=cancelled`,
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: checkoutSession.url || undefined });
  } catch (err) {
    console.error('[create-checkout] Error:', err);

    if (stripe && err instanceof stripe.errors.StripeError) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to create checkout session',
    });
  }
}

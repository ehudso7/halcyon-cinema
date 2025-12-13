import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { addCredits, updateUserSubscription } from '@/utils/db';

// Disable body parsing, need raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Credit amounts for different price IDs
const CREDIT_AMOUNTS: Record<string, number> = {
  price_50_credits: 50,
  price_100_credits: 100,
  price_250_credits: 250,
  price_500_credits: 500,
  price_1000_credits: 1000,
  price_starter: 100,
  price_creator: 500,
  price_studio: 2000,
};

// Subscription tiers for price IDs
const SUBSCRIPTION_TIERS: Record<string, 'free' | 'pro' | 'enterprise'> = {
  price_starter: 'free',
  price_creator: 'pro',
  price_studio: 'enterprise',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  if (!stripe || !webhookSecret) {
    console.error('[webhook] Stripe not configured');
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return res.status(400).json({
      error: `Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
  }

  console.log('[webhook] Received event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const credits = session.metadata?.credits;

        if (!userId) {
          console.error('[webhook] No userId in session metadata');
          break;
        }

        if (session.mode === 'payment' && credits) {
          // One-time credit purchase
          const creditAmount = parseInt(credits, 10);
          if (creditAmount > 0) {
            await addCredits(
              userId,
              creditAmount,
              'purchase',
              `Purchased ${creditAmount} credits`,
              session.id
            );
            console.log(`[webhook] Added ${creditAmount} credits to user ${userId}`);
          }
        } else if (session.mode === 'subscription') {
          // Subscription started - credits are handled by subscription events
          console.log(`[webhook] Subscription started for user ${userId}`);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get user by Stripe customer ID
        const { query } = await import('@/utils/db');
        const result = await query(
          'SELECT id FROM users WHERE stripe_customer_id = $1',
          [customerId]
        );

        if (result.rows.length === 0) {
          console.error('[webhook] No user found for customer:', customerId);
          break;
        }

        const userId = result.rows[0].id as string;
        const priceId = subscription.items.data[0]?.price.id;

        if (priceId && SUBSCRIPTION_TIERS[priceId]) {
          const tier = SUBSCRIPTION_TIERS[priceId];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const expiresAt = new Date((subscription as any).current_period_end * 1000);

          await updateUserSubscription(userId, tier, expiresAt, subscription.id);
          console.log(`[webhook] Updated subscription for user ${userId} to ${tier}`);

          // Add monthly credits if subscription is active
          if (subscription.status === 'active' && CREDIT_AMOUNTS[priceId]) {
            await addCredits(
              userId,
              CREDIT_AMOUNTS[priceId],
              'subscription',
              `Monthly subscription credits (${tier})`,
              subscription.id
            );
            console.log(`[webhook] Added ${CREDIT_AMOUNTS[priceId]} credits for subscription`);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { query } = await import('@/utils/db');
        const result = await query(
          'SELECT id FROM users WHERE stripe_customer_id = $1',
          [customerId]
        );

        if (result.rows.length > 0) {
          const userId = result.rows[0].id as string;
          await updateUserSubscription(userId, 'free', null);
          console.log(`[webhook] Subscription cancelled for user ${userId}`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;

        // Handle subscription renewal
        if (invoice.subscription && invoice.billing_reason === 'subscription_cycle') {
          const customerId = invoice.customer as string;

          const { query } = await import('@/utils/db');
          const result = await query(
            'SELECT id FROM users WHERE stripe_customer_id = $1',
            [customerId]
          );

          if (result.rows.length > 0) {
            const userId = result.rows[0].id as string;

            // Get subscription to determine credits
            const subscription = await stripe.subscriptions.retrieve(
              invoice.subscription as string
            );
            const priceId = subscription.items.data[0]?.price.id;

            if (priceId && CREDIT_AMOUNTS[priceId]) {
              await addCredits(
                userId,
                CREDIT_AMOUNTS[priceId],
                'subscription',
                'Monthly subscription credits renewal',
                invoice.id
              );
              console.log(`[webhook] Added renewal credits for user ${userId}`);
            }
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('[webhook] Payment failed for invoice:', invoice.id);
        // Could send notification to user here
        break;
      }

      default:
        console.log('[webhook] Unhandled event type:', event.type);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[webhook] Error processing event:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Webhook processing failed',
    });
  }
}

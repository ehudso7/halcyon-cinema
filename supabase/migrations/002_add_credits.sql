-- ============================================================================
-- Migration: Add Credits System to Users Table
-- ============================================================================
-- This migration adds credit tracking and subscription management to users.
-- Run this SQL in the Supabase SQL Editor after 001_create_tables_simple.sql
-- ============================================================================

BEGIN;

-- Add credits and subscription columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS credits_remaining INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS lifetime_credits_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

-- Add check constraint for subscription tier
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_subscription_tier_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_subscription_tier_check
      CHECK (subscription_tier IN ('free', 'pro', 'enterprise'));
  END IF;
END $$;

-- Add check constraint for credits (must be non-negative)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_credits_remaining_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_credits_remaining_check
      CHECK (credits_remaining >= 0);
  END IF;
END $$;

-- Create index for Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Create credit transaction log for audit trail
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,
  description TEXT,
  reference_id VARCHAR(255),
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add check constraint for transaction types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_type_check'
  ) THEN
    ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check
      CHECK (transaction_type IN ('purchase', 'subscription', 'generation', 'refund', 'bonus', 'adjustment'));
  END IF;
END $$;

-- Create indexes for credit transaction queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference_id ON credit_transactions(reference_id);

COMMIT;

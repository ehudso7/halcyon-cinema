-- ============================================================================
-- Migration: Rename 'free' subscription tier to 'starter'
-- ============================================================================
-- This migration updates the subscription tier naming convention from 'free'
-- to 'starter' for better product positioning.
-- ============================================================================

BEGIN;

-- Step 1: Update existing 'free' records to 'starter'
UPDATE users SET subscription_tier = 'starter' WHERE subscription_tier = 'free';

-- Step 2: Drop the old CHECK constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;

-- Step 3: Update the default value
ALTER TABLE users ALTER COLUMN subscription_tier SET DEFAULT 'starter';

-- Step 4: Add the new CHECK constraint with 'starter'
ALTER TABLE users ADD CONSTRAINT users_subscription_tier_check
  CHECK (subscription_tier IN ('starter', 'pro', 'enterprise'));

COMMIT;

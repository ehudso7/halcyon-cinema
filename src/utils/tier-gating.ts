/**
 * Subscription Tier Gating Utilities
 *
 * This module provides utilities for checking user permissions based on
 * their subscription tier. It ensures that users can only access features
 * they are entitled to based on their plan.
 *
 * IMPORTANT: Literary works features are available to ALL tiers.
 * Users can write novels and manuscripts without ever touching Writer's Room.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getUserCredits } from '@/utils/db';
import {
  SubscriptionTier,
  TierFeatures,
  TIER_FEATURES,
  hasFeatureAccess,
  getFeatureLimit,
  canUseCinema,
  canUseWritersRoom,
  canUseLiteraryWorks,
  ProjectMode,
  canTransitionMode,
} from '@/config/feature-flags';

// ============================================================================
// Types
// ============================================================================

export interface UserTierInfo {
  userId: string;
  tier: SubscriptionTier;
  features: TierFeatures;
  creditsRemaining: number;
  subscriptionExpiresAt: string | null;
}

export interface TierGateResult {
  allowed: boolean;
  reason?: string;
  requiredTier?: SubscriptionTier;
  currentTier?: SubscriptionTier;
}

export interface ModeAccessResult {
  allowed: boolean;
  reason?: string;
  availableModes: ProjectMode[];
}

// ============================================================================
// User Tier Retrieval
// ============================================================================

/**
 * Get the current user's tier information from the session.
 */
export async function getUserTierInfo(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<UserTierInfo | null> {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return null;
  }

  const credits = await getUserCredits(session.user.id);

  if (!credits) {
    return null;
  }

  const tier = credits.subscriptionTier as SubscriptionTier;

  return {
    userId: session.user.id,
    tier,
    features: TIER_FEATURES[tier],
    creditsRemaining: credits.creditsRemaining,
    subscriptionExpiresAt: credits.subscriptionExpiresAt,
  };
}

// ============================================================================
// Feature Gating
// ============================================================================

/**
 * Check if a user can access a specific feature.
 */
export function checkFeatureAccess(
  tier: SubscriptionTier,
  featurePath: string
): TierGateResult {
  const allowed = hasFeatureAccess(tier, featurePath);

  if (allowed) {
    return { allowed: true };
  }

  // Determine which tier is required
  const requiredTier = findRequiredTier(featurePath);

  return {
    allowed: false,
    reason: `This feature requires a ${requiredTier} subscription`,
    requiredTier,
    currentTier: tier,
  };
}

/**
 * Find the minimum tier required for a feature.
 */
function findRequiredTier(featurePath: string): SubscriptionTier {
  const tiers: SubscriptionTier[] = ['starter', 'pro', 'enterprise'];

  for (const tier of tiers) {
    if (hasFeatureAccess(tier, featurePath)) {
      return tier;
    }
  }

  return 'enterprise';
}

/**
 * Check if a user can access a limit-based feature.
 */
export function checkFeatureLimit(
  tier: SubscriptionTier,
  featurePath: string,
  currentCount: number
): TierGateResult {
  const limit = getFeatureLimit(tier, featurePath);

  // -1 means unlimited
  if (limit === -1 || currentCount < limit) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `You've reached your limit of ${limit} for this feature. Upgrade your plan for more.`,
    currentTier: tier,
    requiredTier: findTierWithHigherLimit(featurePath, limit),
  };
}

/**
 * Find a tier with a higher limit for a feature.
 */
function findTierWithHigherLimit(featurePath: string, currentLimit: number): SubscriptionTier {
  const tiers: SubscriptionTier[] = ['starter', 'pro', 'enterprise'];

  for (const tier of tiers) {
    const limit = getFeatureLimit(tier, featurePath);
    if (limit === -1 || limit > currentLimit) {
      return tier;
    }
  }

  return 'enterprise';
}

// ============================================================================
// Mode Access
// ============================================================================

/**
 * Check which project modes a user can access.
 */
export function checkModeAccess(tier: SubscriptionTier): ModeAccessResult {
  const availableModes: ProjectMode[] = [];

  // Literary works are ALWAYS available (all tiers)
  if (canUseLiteraryWorks(tier)) {
    availableModes.push('literary');
  }

  // Writer's Room requires pro or enterprise
  if (canUseWritersRoom(tier)) {
    availableModes.push('writersRoom');
  }

  // Cinema is available to all paid tiers
  if (canUseCinema(tier)) {
    availableModes.push('cinema');
  }

  return {
    allowed: availableModes.length > 0,
    availableModes,
  };
}

/**
 * Check if a user can transition a project to a different mode.
 */
export function checkModeTransition(
  tier: SubscriptionTier,
  currentMode: ProjectMode,
  targetMode: ProjectMode
): TierGateResult {
  // Check if mode transition is valid
  if (!canTransitionMode(currentMode, targetMode)) {
    return {
      allowed: false,
      reason: `Cannot transition from ${currentMode} to ${targetMode}`,
      currentTier: tier,
    };
  }

  // Check if user has access to target mode
  const modeAccess = checkModeAccess(tier);
  if (!modeAccess.availableModes.includes(targetMode)) {
    const requiredTier = findTierForMode(targetMode);
    return {
      allowed: false,
      reason: `${targetMode} mode requires a ${requiredTier} subscription`,
      requiredTier,
      currentTier: tier,
    };
  }

  return { allowed: true };
}

/**
 * Find the minimum tier required for a mode.
 */
function findTierForMode(mode: ProjectMode): SubscriptionTier {
  switch (mode) {
    case 'literary':
      return 'starter';
    case 'writersRoom':
      return 'pro';
    case 'cinema':
      return 'starter'; // Basic cinema available to starter, advanced features need higher tier
    default:
      return 'starter';
  }
}

// ============================================================================
// API Middleware
// ============================================================================

/**
 * Middleware to require a specific subscription tier.
 * Returns 403 if the user's tier is insufficient.
 */
export async function requireTier(
  req: NextApiRequest,
  res: NextApiResponse,
  requiredTier: SubscriptionTier
): Promise<UserTierInfo | null> {
  const tierInfo = await getUserTierInfo(req, res);

  if (!tierInfo) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const tierOrder: SubscriptionTier[] = ['starter', 'pro', 'enterprise'];
  const requiredIndex = tierOrder.indexOf(requiredTier);
  const currentIndex = tierOrder.indexOf(tierInfo.tier);

  if (currentIndex < requiredIndex) {
    res.status(403).json({
      error: 'Upgrade required',
      message: `This feature requires a ${requiredTier} subscription`,
      currentTier: tierInfo.tier,
      requiredTier,
    });
    return null;
  }

  return tierInfo;
}

/**
 * Middleware to require a specific feature.
 * Returns 403 if the user doesn't have access to the feature.
 */
export async function requireFeature(
  req: NextApiRequest,
  res: NextApiResponse,
  featurePath: string
): Promise<UserTierInfo | null> {
  const tierInfo = await getUserTierInfo(req, res);

  if (!tierInfo) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const result = checkFeatureAccess(tierInfo.tier, featurePath);

  if (!result.allowed) {
    res.status(403).json({
      error: 'Upgrade required',
      message: result.reason,
      currentTier: tierInfo.tier,
      requiredTier: result.requiredTier,
    });
    return null;
  }

  return tierInfo;
}

/**
 * Middleware to require a specific project mode.
 * Returns 403 if the user doesn't have access to the mode.
 */
export async function requireMode(
  req: NextApiRequest,
  res: NextApiResponse,
  mode: ProjectMode
): Promise<UserTierInfo | null> {
  const tierInfo = await getUserTierInfo(req, res);

  if (!tierInfo) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const modeAccess = checkModeAccess(tierInfo.tier);

  if (!modeAccess.availableModes.includes(mode)) {
    const requiredTier = findTierForMode(mode);
    res.status(403).json({
      error: 'Upgrade required',
      message: `${mode} mode requires a ${requiredTier} subscription`,
      currentTier: tierInfo.tier,
      requiredTier,
      availableModes: modeAccess.availableModes,
    });
    return null;
  }

  return tierInfo;
}

// ============================================================================
// Literary Works Access (Always Available)
// ============================================================================

/**
 * Check if a user can use literary works features.
 * Literary works are ALWAYS available to all tiers.
 *
 * This ensures users with existing literary works can continue using
 * Halcyon Cinema without ever touching Writer's Room.
 */
export function canAccessLiteraryWorks(tier: SubscriptionTier): boolean {
  return canUseLiteraryWorks(tier);
}

/**
 * Get literary works features available for a tier.
 */
export function getLiteraryWorksFeatures(tier: SubscriptionTier): TierFeatures['literaryWorks'] {
  return TIER_FEATURES[tier].literaryWorks;
}

/**
 * Check literary works limits for a tier.
 */
export function checkLiteraryWorksLimits(
  tier: SubscriptionTier,
  currentChapters: number,
  currentWords: number
): {
  canAddChapter: boolean;
  canAddWords: boolean;
  chaptersRemaining: number;
  wordsRemainingPerChapter: number;
} {
  const features = TIER_FEATURES[tier].literaryWorks;
  const maxChapters = features.maxChaptersPerProject;
  const maxWords = features.maxWordsPerChapter;

  return {
    canAddChapter: maxChapters === -1 || currentChapters < maxChapters,
    canAddWords: maxWords === -1 || currentWords < maxWords,
    chaptersRemaining: maxChapters === -1 ? -1 : Math.max(0, maxChapters - currentChapters),
    wordsRemainingPerChapter: maxWords === -1 ? -1 : Math.max(0, maxWords - currentWords),
  };
}

// ============================================================================
// Cinema Access
// ============================================================================

/**
 * Check if a user can use cinema features.
 */
export function canAccessCinema(tier: SubscriptionTier): boolean {
  return canUseCinema(tier);
}

/**
 * Get cinema features available for a tier.
 */
export function getCinemaFeatures(tier: SubscriptionTier): TierFeatures['cinema'] {
  return TIER_FEATURES[tier].cinema;
}

// ============================================================================
// Writer's Room Access
// ============================================================================

/**
 * Check if a user can use Writer's Room features.
 */
export function canAccessWritersRoom(tier: SubscriptionTier): boolean {
  return canUseWritersRoom(tier);
}

/**
 * Get Writer's Room features available for a tier.
 */
export function getWritersRoomFeatures(tier: SubscriptionTier): TierFeatures['writersRoom'] {
  return TIER_FEATURES[tier].writersRoom;
}

// ============================================================================
// Export Features
// ============================================================================

/**
 * Get export features available for a tier.
 */
export function getExportFeatures(tier: SubscriptionTier): TierFeatures['exports'] {
  return TIER_FEATURES[tier].exports;
}

/**
 * Check if a specific export format is available.
 */
export function canExportFormat(
  tier: SubscriptionTier,
  format: keyof TierFeatures['exports']
): boolean {
  return TIER_FEATURES[tier].exports[format];
}

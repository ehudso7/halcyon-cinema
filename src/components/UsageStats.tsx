'use client';

import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { useSession } from 'next-auth/react';
import { FilmIcon, FireIcon, PaletteIcon, StarIcon, TrophyIcon, CrownIcon } from './Icons';
import styles from './UsageStats.module.css';

interface UsageData {
  totalGenerations: number;
  todayGenerations: number;
  weekGenerations: number;
  streak: number;
  longestStreak: number;
  creditsUsed: number;
  creditsRemaining: number;
  subscriptionTier: 'starter' | 'pro' | 'enterprise';
  memberSince: string;
  totalProjects: number;
  totalScenes: number;
  favoriteStyle?: string;
  lastGenerationDate?: string;
}

interface UsageStatsProps {
  compact?: boolean;
}

// Store local stats in localStorage (for achievements/streaks only - credits come from server)
const STORAGE_KEY = 'halcyon-usage-stats';

/**
 * Get the maximum credits for a subscription tier.
 */
function getMaxCredits(tier: 'starter' | 'pro' | 'enterprise'): number {
  switch (tier) {
    case 'enterprise': return 10000;
    case 'pro': return 500;
    default: return 100;
  }
}

// Credits are now fetched from the server API
let cachedCredits: { creditsRemaining: number; subscriptionTier: string } | null = null;
let creditsFetchPromise: Promise<{ creditsRemaining: number; subscriptionTier: string } | null> | null = null;

function getDefaultLocalStats(): Omit<UsageData, 'creditsRemaining' | 'subscriptionTier'> {
  return {
    totalGenerations: 0,
    todayGenerations: 0,
    weekGenerations: 0,
    streak: 0,
    longestStreak: 0,
    creditsUsed: 0,
    memberSince: new Date().toISOString(),
    totalProjects: 0,
    totalScenes: 0,
  };
}

function loadLocalStats(): Omit<UsageData, 'creditsRemaining' | 'subscriptionTier'> {
  if (typeof window === 'undefined') return getDefaultLocalStats();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Reset daily counts if needed
      const today = new Date().toDateString();
      const lastGen = data.lastGenerationDate ? new Date(data.lastGenerationDate).toDateString() : null;

      if (lastGen !== today) {
        data.todayGenerations = 0;
      }

      return data;
    }
  } catch {
    // Ignore storage errors
  }

  return getDefaultLocalStats();
}

function saveLocalStats(stats: Omit<UsageData, 'creditsRemaining' | 'subscriptionTier'>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Fetch credits from the server API.
 */
async function fetchCreditsFromServer(): Promise<{ creditsRemaining: number; subscriptionTier: string } | null> {
  try {
    const response = await fetch('/api/credits');
    if (response.ok) {
      const data = await response.json();
      return {
        creditsRemaining: data.credits?.creditsRemaining ?? 100,
        subscriptionTier: data.credits?.subscriptionTier ?? 'starter',
      };
    }
    // If not authenticated or error, return null
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the current credits remaining (fetches from server).
 * Returns cached value if available, otherwise fetches from server.
 */
export async function getCreditsRemaining(): Promise<number> {
  if (cachedCredits) {
    return cachedCredits.creditsRemaining;
  }

  if (!creditsFetchPromise) {
    creditsFetchPromise = fetchCreditsFromServer().then(result => {
      cachedCredits = result;
      creditsFetchPromise = null;
      return result;
    });
  }

  const result = await creditsFetchPromise;
  return result?.creditsRemaining ?? 100;
}

/**
 * Invalidate the credits cache (call after generation to refetch).
 */
export function invalidateCreditsCache() {
  cachedCredits = null;
  creditsFetchPromise = null;
}

/**
 * Track a generation (updates local stats, credits are handled server-side).
 */
export function trackGeneration() {
  if (typeof window === 'undefined') return;

  const data = loadLocalStats();
  const today = new Date();
  const lastGen = data.lastGenerationDate ? new Date(data.lastGenerationDate) : null;

  // Update counts
  data.totalGenerations++;
  data.todayGenerations++;
  data.weekGenerations++;
  data.creditsUsed++;
  data.totalScenes++;

  // Update streak using calendar-based date comparison
  if (lastGen) {
    const todayDate = today.toDateString();
    const lastGenDate = lastGen.toDateString();

    if (todayDate === lastGenDate) {
      // Same calendar day, streak continues unchanged
    } else {
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const lastGenMidnight = new Date(lastGen.getFullYear(), lastGen.getMonth(), lastGen.getDate());
      const daysDiff = Math.round((todayMidnight.getTime() - lastGenMidnight.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        data.streak++;
        data.longestStreak = Math.max(data.longestStreak, data.streak);
      } else {
        data.streak = 1;
      }
    }
  } else {
    data.streak = 1;
  }

  data.lastGenerationDate = today.toISOString();
  saveLocalStats(data);

  // Invalidate credits cache to trigger a refetch
  invalidateCreditsCache();
}

export default function UsageStats({ compact = false }: UsageStatsProps) {
  const { data: session } = useSession();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadUsageData = useCallback(async () => {
    const localStats = loadLocalStats();

    // Fetch server credits if authenticated
    if (session?.user) {
      const serverCredits = await fetchCreditsFromServer();
      if (serverCredits) {
        cachedCredits = serverCredits;
        setUsage({
          ...localStats,
          creditsRemaining: serverCredits.creditsRemaining,
          subscriptionTier: serverCredits.subscriptionTier as 'starter' | 'pro' | 'enterprise',
        });
        setIsLoading(false);
        return;
      }
    }

    // Fallback to default credits if not authenticated or fetch failed
    setUsage({
      ...localStats,
      creditsRemaining: 100,
      subscriptionTier: 'starter',
    });
    setIsLoading(false);
  }, [session]);

  useEffect(() => {
    loadUsageData();

    // Listen for storage changes
    const handleStorage = () => {
      loadUsageData();
    };

    window.addEventListener('storage', handleStorage);

    // Refresh credits periodically (every 30 seconds)
    const interval = setInterval(loadUsageData, 30000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [loadUsageData]);

  if (isLoading || !usage) {
    return compact ? (
      <div className={styles.compactButton}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        <span>...</span>
      </div>
    ) : null;
  }

  const maxCredits = getMaxCredits(usage.subscriptionTier);
  const creditsPercent = Math.min(100, Math.max(0, (usage.creditsRemaining / maxCredits) * 100));
  const isLow = usage.creditsRemaining < 20;

  if (compact) {
    return (
      <button
        className={`${styles.compactButton} ${isLow ? styles.low : ''}`}
        onClick={() => setShowDetails(!showDetails)}
        title="View usage stats"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        <span>{usage.creditsRemaining}</span>

        {showDetails && (
          <>
            <div className={styles.overlay} onClick={() => setShowDetails(false)} />
            <div className={styles.dropdown}>
              <UsageStatsContent usage={usage} />
            </div>
          </>
        )}
      </button>
    );
  }

  return <UsageStatsContent usage={usage} />;
}

function UsageStatsContent({ usage }: { usage: UsageData }) {
  const maxCredits = getMaxCredits(usage.subscriptionTier);
  const creditsPercent = Math.min(100, Math.max(0, (usage.creditsRemaining / maxCredits) * 100));
  const isLow = usage.creditsRemaining < 20;

  const memberDays = Math.floor(
    (new Date().getTime() - new Date(usage.memberSince).getTime()) / (1000 * 60 * 60 * 24)
  );

  const tierLabel = usage.subscriptionTier === 'enterprise' ? 'Enterprise' : usage.subscriptionTier === 'pro' ? 'Pro' : 'Free';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Your Studio Stats</h3>
        <div className={styles.tierBadge} data-tier={usage.subscriptionTier}>
          {tierLabel}
        </div>
        {usage.streak > 0 && (
          <div className={styles.streakBadge}>
            <span className={styles.streakFire}><FireIcon size={16} color="#f97316" /></span>
            {usage.streak} day streak
          </div>
        )}
      </div>

      {/* Credits Section */}
      <div className={styles.creditsSection}>
        <div className={styles.creditsHeader}>
          <span className={styles.creditsLabel}>Credits Remaining</span>
          <span className={`${styles.creditsValue} ${isLow ? styles.low : ''}`}>
            {usage.creditsRemaining}
          </span>
        </div>
        <div className={styles.creditsBar}>
          <div
            className={`${styles.creditsFill} ${isLow ? styles.low : ''}`}
            style={{ width: `${creditsPercent}%` }}
          />
        </div>
        {isLow && usage.subscriptionTier === 'starter' && (
          <p className={styles.creditsWarning}>
            Running low on credits! Upgrade to Pro for 500 credits/month.
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{usage.todayGenerations}</span>
          <span className={styles.statLabel}>Today</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{usage.totalGenerations}</span>
          <span className={styles.statLabel}>All Time</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{usage.totalScenes}</span>
          <span className={styles.statLabel}>Scenes</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{usage.longestStreak}</span>
          <span className={styles.statLabel}>Best Streak</span>
        </div>
      </div>

      {/* Achievements */}
      <div className={styles.achievements}>
        <h4 className={styles.achievementsTitle}>Achievements</h4>
        <div className={styles.achievementsList}>
          <AchievementBadge
            IconComponent={FilmIcon}
            label="First Scene"
            unlocked={usage.totalScenes >= 1}
          />
          <AchievementBadge
            IconComponent={FireIcon}
            label="3-Day Streak"
            unlocked={usage.longestStreak >= 3}
          />
          <AchievementBadge
            IconComponent={PaletteIcon}
            label="10 Creations"
            unlocked={usage.totalGenerations >= 10}
          />
          <AchievementBadge
            IconComponent={StarIcon}
            label="50 Scenes"
            unlocked={usage.totalScenes >= 50}
          />
          <AchievementBadge
            IconComponent={TrophyIcon}
            label="Week Warrior"
            unlocked={usage.longestStreak >= 7}
          />
          <AchievementBadge
            IconComponent={CrownIcon}
            label="Century Club"
            unlocked={usage.totalGenerations >= 100}
          />
        </div>
      </div>

      {/* Member Info */}
      <div className={styles.memberInfo}>
        <span>Member for {memberDays === 0 ? 'less than a day' : `${memberDays} day${memberDays !== 1 ? 's' : ''}`}</span>
      </div>
    </div>
  );
}

function AchievementBadge({
  IconComponent,
  label,
  unlocked,
}: {
  IconComponent: React.FC<{ size?: number; color?: string }>;
  label: string;
  unlocked: boolean;
}) {
  return (
    <div className={`${styles.achievement} ${unlocked ? styles.unlocked : ''}`}>
      <span className={styles.achievementIcon}><IconComponent size={18} /></span>
      <span className={styles.achievementLabel}>{label}</span>
      {unlocked && (
        <span className={styles.achievementCheck}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
      )}
    </div>
  );
}

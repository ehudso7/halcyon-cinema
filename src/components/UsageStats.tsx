'use client';

import { useState, useEffect } from 'react';
import styles from './UsageStats.module.css';

interface UsageData {
  totalGenerations: number;
  todayGenerations: number;
  weekGenerations: number;
  streak: number;
  longestStreak: number;
  creditsUsed: number;
  creditsRemaining: number;
  memberSince: string;
  totalProjects: number;
  totalScenes: number;
  favoriteStyle?: string;
  lastGenerationDate?: string;
}

interface UsageStatsProps {
  compact?: boolean;
}

// Store usage data in localStorage
const STORAGE_KEY = 'halcyon-usage-stats';

function getDefaultUsageData(): UsageData {
  return {
    totalGenerations: 0,
    todayGenerations: 0,
    weekGenerations: 0,
    streak: 0,
    longestStreak: 0,
    creditsUsed: 0,
    creditsRemaining: 100, // Free tier starts with 100 credits
    memberSince: new Date().toISOString(),
    totalProjects: 0,
    totalScenes: 0,
  };
}

function loadUsageData(): UsageData {
  if (typeof window === 'undefined') return getDefaultUsageData();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as UsageData;
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

  return getDefaultUsageData();
}

/**
 * Get the current credits remaining.
 * Returns 100 (default) if not in browser or no data stored.
 */
export function getCreditsRemaining(): number {
  if (typeof window === 'undefined') return 100;
  const data = loadUsageData();
  return data.creditsRemaining;
}

export function trackGeneration() {
  if (typeof window === 'undefined') return;

  const data = loadUsageData();
  const today = new Date();
  const lastGen = data.lastGenerationDate ? new Date(data.lastGenerationDate) : null;

  // Update counts
  data.totalGenerations++;
  data.todayGenerations++;
  data.weekGenerations++;
  data.creditsUsed++;
  data.creditsRemaining = Math.max(0, data.creditsRemaining - 1);
  data.totalScenes++;

  // Update streak using calendar-based date comparison (not time-based)
  if (lastGen) {
    const todayDate = today.toDateString();
    const lastGenDate = lastGen.toDateString();

    if (todayDate === lastGenDate) {
      // Same calendar day, streak continues unchanged
    } else {
      // Calculate the difference in calendar days
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const lastGenMidnight = new Date(lastGen.getFullYear(), lastGen.getMonth(), lastGen.getDate());
      const daysDiff = Math.round((todayMidnight.getTime() - lastGenMidnight.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        // Consecutive calendar day
        data.streak++;
        data.longestStreak = Math.max(data.longestStreak, data.streak);
      } else {
        // Streak broken (more than 1 day gap)
        data.streak = 1;
      }
    }
  } else {
    data.streak = 1;
  }

  data.lastGenerationDate = today.toISOString();

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export function addCredits(amount: number) {
  if (typeof window === 'undefined') return;

  const data = loadUsageData();
  data.creditsRemaining += amount;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export default function UsageStats({ compact = false }: UsageStatsProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setUsage(loadUsageData());

    // Listen for storage changes
    const handleStorage = () => {
      setUsage(loadUsageData());
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!usage) return null;

  // Clamp credits percent to 0-100 range (in case credits exceed max via addCredits)
  const maxCredits = 100;
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
  // Clamp credits percent to 0-100 range (in case credits exceed max via addCredits)
  const maxCredits = 100;
  const creditsPercent = Math.min(100, Math.max(0, (usage.creditsRemaining / maxCredits) * 100));
  const isLow = usage.creditsRemaining < 20;

  const memberDays = Math.floor(
    (new Date().getTime() - new Date(usage.memberSince).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Your Studio Stats</h3>
        {usage.streak > 0 && (
          <div className={styles.streakBadge}>
            <span className={styles.streakFire}>🔥</span>
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
        {isLow && (
          <p className={styles.creditsWarning}>
            Running low on credits! Upgrade for unlimited generations.
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
            icon="🎬"
            label="First Scene"
            unlocked={usage.totalScenes >= 1}
          />
          <AchievementBadge
            icon="🔥"
            label="3-Day Streak"
            unlocked={usage.longestStreak >= 3}
          />
          <AchievementBadge
            icon="🎨"
            label="10 Creations"
            unlocked={usage.totalGenerations >= 10}
          />
          <AchievementBadge
            icon="⭐"
            label="50 Scenes"
            unlocked={usage.totalScenes >= 50}
          />
          <AchievementBadge
            icon="🏆"
            label="Week Warrior"
            unlocked={usage.longestStreak >= 7}
          />
          <AchievementBadge
            icon="👑"
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
  icon,
  label,
  unlocked,
}: {
  icon: string;
  label: string;
  unlocked: boolean;
}) {
  return (
    <div className={`${styles.achievement} ${unlocked ? styles.unlocked : ''}`}>
      <span className={styles.achievementIcon}>{icon}</span>
      <span className={styles.achievementLabel}>{label}</span>
      {unlocked && <span className={styles.achievementCheck}>✓</span>}
    </div>
  );
}

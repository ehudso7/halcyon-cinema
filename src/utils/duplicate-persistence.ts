/**
 * Client-side persistence utility for duplicate handling decisions.
 * Stores user's merge/dismiss/delete decisions in localStorage to persist
 * across sessions and page reloads.
 */

const STORAGE_KEY_PREFIX = 'halcyon_duplicate_decisions';

interface DuplicateDecision {
  action: 'merge' | 'dismiss' | 'delete';
  primaryId?: string; // For merge actions, the ID that was kept
  removedIds?: string[]; // For merge/delete actions, the IDs that were removed
  timestamp: number;
}

interface DuplicateDecisions {
  [groupKey: string]: DuplicateDecision;
}

/**
 * Get storage key for a specific project or context
 */
function getStorageKey(contextId: string): string {
  return `${STORAGE_KEY_PREFIX}_${contextId}`;
}

/**
 * Load all duplicate decisions for a context from localStorage
 */
export function loadDuplicateDecisions(contextId: string): DuplicateDecisions {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(getStorageKey(contextId));
    if (!stored) return {};

    const parsed = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return {};

    return parsed as DuplicateDecisions;
  } catch (error) {
    console.error('[duplicate-persistence] Failed to load decisions:', error);
    return {};
  }
}

/**
 * Save a duplicate decision to localStorage
 */
export function saveDuplicateDecision(
  contextId: string,
  groupKey: string,
  decision: Omit<DuplicateDecision, 'timestamp'>
): void {
  if (typeof window === 'undefined') return;

  try {
    const decisions = loadDuplicateDecisions(contextId);
    decisions[groupKey] = {
      ...decision,
      timestamp: Date.now(),
    };
    localStorage.setItem(getStorageKey(contextId), JSON.stringify(decisions));
  } catch (error) {
    console.error('[duplicate-persistence] Failed to save decision:', error);
  }
}

/**
 * Record a merge decision
 */
export function recordMergeDecision(
  contextId: string,
  groupKey: string,
  primaryId: string,
  removedIds: string[]
): void {
  saveDuplicateDecision(contextId, groupKey, {
    action: 'merge',
    primaryId,
    removedIds,
  });
}

/**
 * Record a dismiss decision (not duplicates)
 */
export function recordDismissDecision(contextId: string, groupKey: string): void {
  saveDuplicateDecision(contextId, groupKey, {
    action: 'dismiss',
  });
}

/**
 * Record a delete decision
 */
export function recordDeleteDecision(contextId: string, itemId: string): void {
  saveDuplicateDecision(contextId, `deleted_${itemId}`, {
    action: 'delete',
    removedIds: [itemId],
  });
}

/**
 * Check if a group has been dismissed
 */
export function isGroupDismissed(contextId: string, groupKey: string): boolean {
  const decisions = loadDuplicateDecisions(contextId);
  const decision = decisions[groupKey];
  return decision?.action === 'dismiss' || decision?.action === 'merge';
}

/**
 * Get all dismissed group keys for a context
 */
export function getDismissedGroups(contextId: string): Set<string> {
  const decisions = loadDuplicateDecisions(contextId);
  const dismissed = new Set<string>();

  Object.entries(decisions).forEach(([key, decision]) => {
    if (decision.action === 'dismiss' || decision.action === 'merge') {
      dismissed.add(key);
    }
  });

  return dismissed;
}

/**
 * Get all deleted item IDs for a context
 */
export function getDeletedItemIds(contextId: string): Set<string> {
  const decisions = loadDuplicateDecisions(contextId);
  const deleted = new Set<string>();

  Object.values(decisions).forEach(decision => {
    if (decision.action === 'delete' && decision.removedIds) {
      decision.removedIds.forEach(id => deleted.add(id));
    }
    if (decision.action === 'merge' && decision.removedIds) {
      decision.removedIds.forEach(id => deleted.add(id));
    }
  });

  return deleted;
}

/**
 * Clear all decisions for a context (e.g., when starting a new import)
 */
export function clearDecisions(contextId: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(getStorageKey(contextId));
  } catch (error) {
    console.error('[duplicate-persistence] Failed to clear decisions:', error);
  }
}

/**
 * Clear expired decisions (older than maxAge in milliseconds)
 * Default: 7 days
 */
export function clearExpiredDecisions(contextId: string, maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
  if (typeof window === 'undefined') return;

  try {
    const decisions = loadDuplicateDecisions(contextId);
    const now = Date.now();
    let hasChanges = false;

    Object.entries(decisions).forEach(([key, decision]) => {
      if (now - decision.timestamp > maxAge) {
        delete decisions[key];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      localStorage.setItem(getStorageKey(contextId), JSON.stringify(decisions));
    }
  } catch (error) {
    console.error('[duplicate-persistence] Failed to clear expired decisions:', error);
  }
}

/**
 * Export all decisions for debugging/backup
 */
export function exportDecisions(contextId: string): string {
  const decisions = loadDuplicateDecisions(contextId);
  return JSON.stringify(decisions, null, 2);
}

/**
 * Import decisions from a backup
 */
export function importDecisions(contextId: string, jsonData: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const parsed = JSON.parse(jsonData);
    if (typeof parsed !== 'object' || parsed === null) {
      return false;
    }

    localStorage.setItem(getStorageKey(contextId), JSON.stringify(parsed));
    return true;
  } catch (error) {
    console.error('[duplicate-persistence] Failed to import decisions:', error);
    return false;
  }
}

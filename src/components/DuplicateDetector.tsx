import { useState, useMemo, useCallback } from 'react';
import { AlertIcon, MergeIcon, TrashIcon, CheckCircleIcon } from './Icons';
import styles from './DuplicateDetector.module.css';

interface DuplicateItem {
  id: string;
  name: string;
  description?: string;
  type: 'character' | 'location' | 'event' | 'lore';
  appearances?: number[];
  [key: string]: unknown;
}

interface DuplicateGroup {
  key: string;
  items: DuplicateItem[];
  similarity: number;
}

interface DuplicateDetectorProps {
  items: DuplicateItem[];
  type: 'character' | 'location' | 'event' | 'lore';
  onMerge: (keepId: string, removeIds: string[]) => void;
  onRemove: (id: string) => void;
  onDismiss: (groupKey: string) => void;
  similarityThreshold?: number;
}

/**
 * Calculates similarity between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check for substring match
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.85;
  }

  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}

/**
 * Find duplicate groups based on name similarity
 */
function findDuplicates(items: DuplicateItem[], threshold: number): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    if (processed.has(items[i].id)) continue;

    const group: DuplicateItem[] = [items[i]];
    let maxSimilarity = 0;

    for (let j = i + 1; j < items.length; j++) {
      if (processed.has(items[j].id)) continue;

      const similarity = calculateSimilarity(items[i].name, items[j].name);
      if (similarity >= threshold) {
        group.push(items[j]);
        maxSimilarity = Math.max(maxSimilarity, similarity);
        processed.add(items[j].id);
      }
    }

    if (group.length > 1) {
      processed.add(items[i].id);
      groups.push({
        key: `group-${items[i].id}`,
        items: group,
        similarity: maxSimilarity,
      });
    }
  }

  return groups.sort((a, b) => b.similarity - a.similarity);
}

/**
 * DuplicateDetector component for identifying and managing duplicate items.
 * Supports characters, locations, events, and lore items.
 */
export default function DuplicateDetector({
  items,
  type,
  onMerge,
  onRemove,
  onDismiss,
  similarityThreshold = 0.7,
}: DuplicateDetectorProps) {
  const [dismissedGroups, setDismissedGroups] = useState<Set<string>>(new Set());
  const [selectedForMerge, setSelectedForMerge] = useState<Map<string, string>>(new Map());

  const duplicateGroups = useMemo(() => {
    const groups = findDuplicates(items, similarityThreshold);
    return groups.filter((g) => !dismissedGroups.has(g.key));
  }, [items, similarityThreshold, dismissedGroups]);

  const handleDismiss = useCallback(
    (groupKey: string) => {
      setDismissedGroups((prev) => new Set([...prev, groupKey]));
      onDismiss(groupKey);
    },
    [onDismiss]
  );

  const handleSelectPrimary = useCallback((groupKey: string, itemId: string) => {
    setSelectedForMerge((prev) => new Map(prev).set(groupKey, itemId));
  }, []);

  const handleMerge = useCallback(
    (group: DuplicateGroup) => {
      const primaryId = selectedForMerge.get(group.key) || group.items[0].id;
      const removeIds = group.items.filter((i) => i.id !== primaryId).map((i) => i.id);
      onMerge(primaryId, removeIds);
      setDismissedGroups((prev) => new Set([...prev, group.key]));
    },
    [selectedForMerge, onMerge]
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      onRemove(itemId);
    },
    [onRemove]
  );

  if (duplicateGroups.length === 0) {
    return null;
  }

  const typeLabels: Record<string, string> = {
    character: 'Characters',
    location: 'Locations',
    event: 'Events',
    lore: 'Lore Items',
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <AlertIcon size={20} />
        <span>
          {duplicateGroups.length} potential duplicate{duplicateGroups.length !== 1 ? 's' : ''} found in{' '}
          {typeLabels[type]}
        </span>
      </div>

      <div className={styles.groups}>
        {duplicateGroups.map((group) => (
          <div key={group.key} className={styles.group}>
            <div className={styles.groupHeader}>
              <span className={styles.similarity}>
                {Math.round(group.similarity * 100)}% similar
              </span>
              <div className={styles.groupActions}>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.mergeBtn}`}
                  onClick={() => handleMerge(group)}
                  title="Merge duplicates"
                >
                  <MergeIcon size={16} />
                  Merge
                </button>
                <button
                  type="button"
                  className={styles.dismissBtn}
                  onClick={() => handleDismiss(group.key)}
                  title="Dismiss"
                >
                  Not duplicates
                </button>
              </div>
            </div>

            <div className={styles.itemList}>
              {group.items.map((item) => {
                const isPrimary = selectedForMerge.get(group.key) === item.id ||
                  (!selectedForMerge.has(group.key) && item === group.items[0]);

                return (
                  <div
                    key={item.id}
                    className={`${styles.item} ${isPrimary ? styles.primary : ''}`}
                  >
                    <button
                      type="button"
                      className={styles.selectBtn}
                      onClick={() => handleSelectPrimary(group.key, item.id)}
                      title={isPrimary ? 'Primary item (will be kept)' : 'Click to make primary'}
                    >
                      {isPrimary ? (
                        <CheckCircleIcon size={18} color="#10b981" />
                      ) : (
                        <div className={styles.emptyCircle} />
                      )}
                    </button>

                    <div className={styles.itemContent}>
                      <span className={styles.itemName}>{item.name}</span>
                      {item.description && (
                        <span className={styles.itemDesc}>
                          {item.description.substring(0, 80)}...
                        </span>
                      )}
                      {item.appearances && (
                        <span className={styles.itemMeta}>
                          {item.appearances.length} appearance{item.appearances.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.removeBtn}`}
                      onClick={() => handleRemoveItem(item.id)}
                      title="Remove this item"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                );
              })}
            </div>

            <p className={styles.hint}>
              Select the primary item to keep, then click Merge. Other items will be removed.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Hook to use duplicate detection in components
 */
export function useDuplicateDetection<T extends DuplicateItem>(
  items: T[],
  type: 'character' | 'location' | 'event' | 'lore',
  threshold = 0.7
) {
  const duplicates = useMemo(() => findDuplicates(items, threshold), [items, threshold]);

  return {
    hasDuplicates: duplicates.length > 0,
    duplicateCount: duplicates.length,
    duplicateGroups: duplicates,
  };
}

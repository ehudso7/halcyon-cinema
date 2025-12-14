import { useState, useEffect, useCallback, useRef } from 'react';

const AUTO_SAVE_KEY_PREFIX = 'halcyon_autosave';
const DEFAULT_DEBOUNCE_MS = 2000; // 2 seconds

interface AutoSaveState<T> {
  data: T;
  lastSaved: number | null;
  isDirty: boolean;
}

interface UseAutoSaveOptions<T> {
  /** Unique key for storing data (e.g., 'novel_import_<sessionId>') */
  storageKey: string;
  /** Initial data if nothing in storage */
  initialData: T;
  /** Debounce time in milliseconds (default: 2000ms) */
  debounceMs?: number;
  /** Callback when data is auto-saved */
  onSave?: (data: T) => void;
  /** Callback when data is restored from storage */
  onRestore?: (data: T) => void;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
}

interface UseAutoSaveReturn<T> {
  /** Current data */
  data: T;
  /** Update data - triggers auto-save after debounce */
  setData: (data: T | ((prev: T) => T)) => void;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Timestamp of last save (null if never saved) */
  lastSaved: number | null;
  /** Manually trigger save immediately */
  saveNow: () => void;
  /** Clear saved data from storage */
  clearSaved: () => void;
  /** Whether auto-save is currently in progress */
  isSaving: boolean;
  /** Check if there's saved data in storage */
  hasSavedData: boolean;
  /** Restore data from storage */
  restoreFromStorage: () => boolean;
  /** Discard unsaved changes and restore from storage */
  discardChanges: () => void;
}

/**
 * Hook for auto-saving data to localStorage with debouncing
 */
export function useAutoSave<T>(options: UseAutoSaveOptions<T>): UseAutoSaveReturn<T> {
  const {
    storageKey,
    initialData,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    onSave,
    onRestore,
    enabled = true,
  } = options;

  const fullKey = `${AUTO_SAVE_KEY_PREFIX}_${storageKey}`;

  // State
  const [state, setState] = useState<AutoSaveState<T>>({
    data: initialData,
    lastSaved: null,
    isDirty: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasSavedData, setHasSavedData] = useState(false);

  // Refs for debouncing
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<T>(initialData);

  // Check if there's saved data on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(fullKey);
      setHasSavedData(saved !== null);
    } catch {
      setHasSavedData(false);
    }
  }, [fullKey]);

  // Restore from storage
  const restoreFromStorage = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;

    try {
      const saved = localStorage.getItem(fullKey);
      if (!saved) return false;

      const parsed = JSON.parse(saved) as { data: T; timestamp: number };
      setState({
        data: parsed.data,
        lastSaved: parsed.timestamp,
        isDirty: false,
      });
      lastDataRef.current = parsed.data;
      onRestore?.(parsed.data);
      return true;
    } catch (error) {
      console.error('[useAutoSave] Failed to restore from storage:', error);
      return false;
    }
  }, [fullKey, onRestore]);

  // Auto-restore on mount if there's saved data
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(fullKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { data: T; timestamp: number };
        // Only auto-restore if the saved data is recent (within 24 hours)
        const ONE_DAY = 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp < ONE_DAY) {
          setState({
            data: parsed.data,
            lastSaved: parsed.timestamp,
            isDirty: false,
          });
          lastDataRef.current = parsed.data;
          onRestore?.(parsed.data);
        }
      }
    } catch (error) {
      console.error('[useAutoSave] Failed to restore from storage:', error);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to storage
  const saveToStorage = useCallback((data: T) => {
    if (typeof window === 'undefined') return;

    setIsSaving(true);
    try {
      const timestamp = Date.now();
      const saveData = JSON.stringify({ data, timestamp });
      localStorage.setItem(fullKey, saveData);
      setState(prev => ({
        ...prev,
        lastSaved: timestamp,
        isDirty: false,
      }));
      setHasSavedData(true);
      onSave?.(data);
    } catch (error) {
      console.error('[useAutoSave] Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [fullKey, onSave]);

  // Save immediately
  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    saveToStorage(state.data);
  }, [saveToStorage, state.data]);

  // Clear saved data
  const clearSaved = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(fullKey);
      setHasSavedData(false);
      setState(prev => ({
        ...prev,
        lastSaved: null,
      }));
    } catch (error) {
      console.error('[useAutoSave] Failed to clear:', error);
    }
  }, [fullKey]);

  // Discard changes and restore from storage
  const discardChanges = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const restored = restoreFromStorage();
    if (!restored) {
      // If nothing to restore, reset to initial data
      setState({
        data: initialData,
        lastSaved: null,
        isDirty: false,
      });
      lastDataRef.current = initialData;
    }
  }, [restoreFromStorage, initialData]);

  // Set data with debounced auto-save
  const setData = useCallback((newData: T | ((prev: T) => T)) => {
    setState(prev => {
      const resolvedData = typeof newData === 'function'
        ? (newData as (prev: T) => T)(prev.data)
        : newData;

      lastDataRef.current = resolvedData;

      return {
        ...prev,
        data: resolvedData,
        isDirty: true,
      };
    });

    // Schedule auto-save if enabled
    if (enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        saveToStorage(lastDataRef.current);
        timeoutRef.current = null;
      }, debounceMs);
    }
  }, [enabled, debounceMs, saveToStorage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Save before unload if dirty
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.isDirty && enabled) {
        // Try to save synchronously before leaving
        try {
          const saveData = JSON.stringify({
            data: state.data,
            timestamp: Date.now(),
          });
          localStorage.setItem(fullKey, saveData);
        } catch {
          // Ignore errors during beforeunload
        }

        // Show confirmation dialog
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.isDirty, state.data, enabled, fullKey]);

  return {
    data: state.data,
    setData,
    isDirty: state.isDirty,
    lastSaved: state.lastSaved,
    saveNow,
    clearSaved,
    isSaving,
    hasSavedData,
    restoreFromStorage,
    discardChanges,
  };
}

/**
 * Helper to format the last saved timestamp
 */
export function formatLastSaved(timestamp: number | null): string {
  if (!timestamp) return 'Never saved';

  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return 'Just now';
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
}

/**
 * Get all auto-save keys in localStorage
 */
export function getAllAutoSaveKeys(): string[] {
  if (typeof window === 'undefined') return [];

  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(AUTO_SAVE_KEY_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Clear all auto-saved data
 */
export function clearAllAutoSaves(): void {
  if (typeof window === 'undefined') return;

  getAllAutoSaveKeys().forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  });
}

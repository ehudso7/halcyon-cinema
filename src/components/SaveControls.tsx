import { formatLastSaved } from '@/hooks/useAutoSave';
import styles from './SaveControls.module.css';

interface SaveButtonProps {
  /** Whether to show the save button */
  show?: boolean;
  /** Whether data is currently being saved */
  isSaving?: boolean;
  /** Whether there are unsaved changes */
  isDirty?: boolean;
  /** Callback when save button is clicked */
  onSave: () => void;
  /** Button label (default: "Save") */
  label?: string;
  /** Additional CSS class */
  className?: string;
}

/**
 * Manual save button component
 */
export function SaveButton({
  show = true,
  isSaving = false,
  isDirty = false,
  onSave,
  label = 'Save',
  className = '',
}: SaveButtonProps) {
  if (!show) return null;

  const handleClick = () => {
    if (!isSaving) {
      onSave();
    }
  };

  return (
    <button
      type="button"
      className={`${styles.saveButton} ${isDirty ? styles.dirty : ''} ${isSaving ? styles.saving : ''} ${className}`}
      onClick={handleClick}
      disabled={isSaving || !isDirty}
      title={isDirty ? 'Save changes' : 'No unsaved changes'}
    >
      {isSaving ? (
        <>
          <span className={styles.spinner} />
          Saving...
        </>
      ) : (
        <>
          <SaveIcon />
          {label}
        </>
      )}
    </button>
  );
}

interface AutoSaveIndicatorProps {
  /** Whether auto-save is enabled */
  enabled?: boolean;
  /** Whether currently saving */
  isSaving?: boolean;
  /** Whether there are unsaved changes */
  isDirty?: boolean;
  /** Timestamp of last save */
  lastSaved?: number | null;
  /** Additional CSS class */
  className?: string;
}

/**
 * Auto-save status indicator component
 */
export function AutoSaveIndicator({
  enabled = true,
  isSaving = false,
  isDirty = false,
  lastSaved = null,
  className = '',
}: AutoSaveIndicatorProps) {
  if (!enabled) return null;

  return (
    <div className={`${styles.autoSaveIndicator} ${className}`}>
      {isSaving ? (
        <span className={styles.savingStatus}>
          <span className={styles.spinnerSmall} />
          Saving...
        </span>
      ) : isDirty ? (
        <span className={styles.dirtyStatus}>
          <span className={styles.dot} />
          Unsaved changes
        </span>
      ) : lastSaved ? (
        <span className={styles.savedStatus}>
          <CheckIcon />
          Saved {formatLastSaved(lastSaved)}
        </span>
      ) : (
        <span className={styles.neverSavedStatus}>
          Auto-save enabled
        </span>
      )}
    </div>
  );
}

interface SaveControlsBarProps {
  /** Whether to show the save controls */
  show?: boolean;
  /** Whether auto-save is enabled */
  autoSaveEnabled?: boolean;
  /** Whether currently saving */
  isSaving?: boolean;
  /** Whether there are unsaved changes */
  isDirty?: boolean;
  /** Timestamp of last save */
  lastSaved?: number | null;
  /** Callback when manual save is triggered */
  onSave: () => void;
  /** Callback when discard changes is clicked */
  onDiscard?: () => void;
  /** Whether to show discard button */
  showDiscard?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Full save controls bar with save button and auto-save indicator
 */
export function SaveControlsBar({
  show = true,
  autoSaveEnabled = true,
  isSaving = false,
  isDirty = false,
  lastSaved = null,
  onSave,
  onDiscard,
  showDiscard = false,
  className = '',
}: SaveControlsBarProps) {
  if (!show) return null;

  return (
    <div className={`${styles.saveControlsBar} ${className}`}>
      <AutoSaveIndicator
        enabled={autoSaveEnabled}
        isSaving={isSaving}
        isDirty={isDirty}
        lastSaved={lastSaved}
      />

      <div className={styles.buttonGroup}>
        {showDiscard && isDirty && onDiscard && (
          <button
            type="button"
            className={styles.discardButton}
            onClick={onDiscard}
            disabled={isSaving}
          >
            Discard Changes
          </button>
        )}

        <SaveButton
          isSaving={isSaving}
          isDirty={isDirty}
          onSave={onSave}
        />
      </div>
    </div>
  );
}

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

/**
 * Modal to confirm unsaved changes when navigating away
 */
export function UnsavedChangesModal({
  isOpen,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Unsaved Changes</h3>
        <p className={styles.modalText}>
          You have unsaved changes. Would you like to save before leaving?
        </p>
        <div className={styles.modalButtons}>
          <button
            type="button"
            className={styles.discardButton}
            onClick={onDiscard}
          >
            Discard
          </button>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.saveButtonPrimary}
            onClick={onSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple icon components
function SaveIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

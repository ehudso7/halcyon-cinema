import React from 'react';
import { LoreEntry } from '@/types';
import { UserIcon, LocationIcon, CalendarIcon, CogIcon, FilmIcon } from './Icons';
import ImageWithFallback from './ImageWithFallback';
import styles from './LoreCard.module.css';

type ViewMode = 'grid' | 'list';

interface LoreCardProps {
  entry: LoreEntry;
  viewMode?: ViewMode;
  isSelected?: boolean;
  onSelect?: () => void;
  onEdit?: (entry: LoreEntry) => void;
  onDelete?: () => void;
  onShowDetail?: () => void;
  onLinkScene?: (id: string) => void;
}

const TYPE_ICON_COMPONENTS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  character: UserIcon,
  location: LocationIcon,
  event: CalendarIcon,
  system: CogIcon,
};

const TYPE_COLORS: Record<string, string> = {
  character: '#a78bfa',
  location: '#34d399',
  event: '#fbbf24',
  system: '#60a5fa',
};

export default function LoreCard({
  entry,
  viewMode = 'grid',
  isSelected = false,
  onSelect,
  onEdit,
  onDelete,
  onShowDetail,
  onLinkScene,
}: LoreCardProps) {
  // List view
  if (viewMode === 'list') {
    return (
      <div className={`${styles.listCard} ${isSelected ? styles.selected : ''}`}>
        {onSelect && (
          <button
            className={styles.checkbox}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
          >
            <div className={`${styles.checkboxInner} ${isSelected ? styles.checked : ''}`}>
              {isSelected && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </button>
        )}

        <div
          className={styles.listTypeIcon}
          style={{ backgroundColor: TYPE_COLORS[entry.type] + '20', color: TYPE_COLORS[entry.type] }}
          {...(onShowDetail && {
            onClick: onShowDetail,
            onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onShowDetail(); } },
            role: 'button',
            tabIndex: 0,
            'aria-label': `View ${entry.name} details`,
          })}
        >
          {entry.imageUrl ? (
            <ImageWithFallback
              src={entry.imageUrl}
              alt={entry.name}
              width={40}
              height={40}
              fallbackType="generic"
              showExpiredMessage={false}
            />
          ) : (
            React.createElement(TYPE_ICON_COMPONENTS[entry.type] || UserIcon, { size: 24, color: TYPE_COLORS[entry.type] })
          )}
        </div>

        <div
          className={styles.listContent}
          {...(onShowDetail && {
            onClick: onShowDetail,
            onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onShowDetail(); } },
            role: 'button',
            tabIndex: 0,
            'aria-label': `View ${entry.name} details`,
          })}
        >
          <div className={styles.listHeader}>
            <h3 className={styles.listName}>{entry.name}</h3>
            <span
              className={styles.listType}
              style={{ color: TYPE_COLORS[entry.type] }}
            >
              {entry.type}
            </span>
          </div>
          <p className={styles.listSummary}>{entry.summary}</p>
          <div className={styles.listMeta}>
            {entry.tags && entry.tags.length > 0 && (
              <div className={styles.listTags}>
                {entry.tags.slice(0, 3).map((tag, i) => (
                  <span key={i} className={styles.listTag}>{tag}</span>
                ))}
                {entry.tags.length > 3 && (
                  <span className={styles.moreTags}>+{entry.tags.length - 3}</span>
                )}
              </div>
            )}
            {entry.associatedScenes && entry.associatedScenes.length > 0 && (
              <span className={styles.sceneCount}>
                <FilmIcon size={14} /> {entry.associatedScenes.length}
              </span>
            )}
          </div>
        </div>

        <div className={styles.listActions}>
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
              className={styles.actionBtn}
              title="Edit"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className={`${styles.actionBtn} ${styles.deleteBtn}`}
              title="Delete"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Grid view (default)
  return (
    <div className={`${styles.cardWrapper} ${isSelected ? styles.selected : ''}`}>
      {onSelect && (
        <button
          className={styles.checkbox}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        >
          <div className={`${styles.checkboxInner} ${isSelected ? styles.checked : ''}`}>
            {isSelected && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </button>
      )}

      <div
        className={styles.card}
        {...(onShowDetail && {
          onClick: onShowDetail,
          onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onShowDetail(); } },
          role: 'button',
          tabIndex: 0,
          'aria-label': `View ${entry.name} details`,
        })}
      >
        <div className={styles.header}>
          <div
            className={styles.typeIcon}
            style={{ backgroundColor: TYPE_COLORS[entry.type] + '20', color: TYPE_COLORS[entry.type] }}
          >
            {entry.imageUrl ? (
              <ImageWithFallback
                src={entry.imageUrl}
                alt={entry.name}
                width={36}
                height={36}
                fallbackType="generic"
                showExpiredMessage={false}
              />
            ) : (
              React.createElement(TYPE_ICON_COMPONENTS[entry.type] || UserIcon, { size: 20, color: TYPE_COLORS[entry.type] })
            )}
          </div>
          <div className={styles.headerContent}>
            <h3 className={styles.name}>{entry.name}</h3>
            <span className={styles.type}>{entry.type}</span>
          </div>
        </div>

        <p className={styles.summary}>{entry.summary}</p>

        {entry.description && (
          <p className={styles.description}>{entry.description}</p>
        )}

        {entry.tags && entry.tags.length > 0 && (
          <div className={styles.tags}>
            {entry.tags.map((tag, index) => (
              <span key={index} className={styles.tag}>{tag}</span>
            ))}
          </div>
        )}

        {entry.associatedScenes && entry.associatedScenes.length > 0 && (
          <div className={styles.scenes}>
            <span className={styles.sceneCount}>
              <FilmIcon size={14} /> {entry.associatedScenes.length} linked scene{entry.associatedScenes.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {(onEdit || onDelete || onLinkScene) && (
        <div className={styles.cardActions}>
          {onLinkScene && (
            <button
              onClick={(e) => { e.stopPropagation(); onLinkScene(entry.id); }}
              className={styles.actionBtn}
              title="Link to scene"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
            </button>
          )}
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
              className={styles.actionBtn}
              title="Edit"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className={`${styles.actionBtn} ${styles.deleteBtn}`}
              title="Delete"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

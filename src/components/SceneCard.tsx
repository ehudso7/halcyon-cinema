import Link from 'next/link';
import { Scene } from '@/types';
import ImageWithFallback from './ImageWithFallback';
import styles from './SceneCard.module.css';

type ViewMode = 'grid' | 'list';

interface SceneCardProps {
  scene: Scene;
  index: number;
  viewMode?: ViewMode;
  isSelected?: boolean;
  onSelect?: () => void;
  onDuplicate?: () => void;
}

export default function SceneCard({
  scene,
  index,
  viewMode = 'grid',
  isSelected = false,
  onSelect,
  onDuplicate,
}: SceneCardProps) {
  const timestamp = new Date(scene.createdAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const truncatedPrompt = scene.prompt.length > 100
    ? scene.prompt.slice(0, 100) + '...'
    : scene.prompt;

  const handleSelect = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect?.();
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDuplicate?.();
  };

  if (viewMode === 'list') {
    return (
      <div className={`${styles.listCard} ${isSelected ? styles.selected : ''}`}>
        {onSelect && (
          <button className={styles.checkbox} onClick={handleSelect}>
            <div className={`${styles.checkboxInner} ${isSelected ? styles.checked : ''}`}>
              {isSelected && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </button>
        )}

        <Link href={`/project/${scene.projectId}/scene/${scene.id}`} className={styles.listLink}>
          <div className={styles.listThumbnail}>
            <ImageWithFallback
              src={scene.imageUrl}
              alt={`Scene ${index + 1}`}
              fill
              sizes="80px"
              fallbackType="scene"
            />
          </div>

          <div className={styles.listContent}>
            <div className={styles.listHeader}>
              <span className={styles.listNumber}>Scene {index + 1}</span>
              {scene.metadata?.shotType && (
                <span className={styles.listTag}>{scene.metadata.shotType}</span>
              )}
              {scene.metadata?.mood && (
                <span className={styles.listTag}>{scene.metadata.mood}</span>
              )}
            </div>
            <p className={styles.listPrompt}>{truncatedPrompt}</p>
            <span className={styles.listTimestamp}>{timestamp}</span>
          </div>
        </Link>

        <div className={styles.listActions}>
          {onDuplicate && (
            <button
              className={styles.actionButton}
              onClick={handleDuplicate}
              title="Duplicate scene"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            </button>
          )}
          <Link
            href={`/project/${scene.projectId}/scene/${scene.id}`}
            className={styles.actionButton}
            title="Edit scene"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.cardWrapper} ${isSelected ? styles.selected : ''}`}>
      {onSelect && (
        <button className={styles.checkbox} onClick={handleSelect}>
          <div className={`${styles.checkboxInner} ${isSelected ? styles.checked : ''}`}>
            {isSelected && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </button>
      )}

      <Link
        href={`/project/${scene.projectId}/scene/${scene.id}`}
        className={styles.card}
      >
        <div className={styles.thumbnail}>
          <ImageWithFallback
            src={scene.imageUrl}
            alt={`Scene ${index + 1}`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            priority={index < 3}
            fallbackType="scene"
          />
          <div className={styles.number}>Scene {index + 1}</div>
          {scene.imageUrl && (
            <div className={styles.aiBadge}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              AI
            </div>
          )}

          {/* Metadata tags */}
          <div className={styles.metaTags}>
            {scene.metadata?.shotType && (
              <span className={styles.metaTag}>{scene.metadata.shotType}</span>
            )}
            {scene.metadata?.mood && (
              <span className={styles.metaTag}>{scene.metadata.mood}</span>
            )}
          </div>

          {/* Quick actions overlay */}
          <div className={styles.quickActions}>
            {onDuplicate && (
              <button
                className={styles.quickAction}
                onClick={handleDuplicate}
                title="Duplicate scene"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              </button>
            )}
            <span className={styles.quickAction} title="Edit scene">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </span>
          </div>
        </div>
        <div className={styles.content}>
          <p className={styles.prompt}>{truncatedPrompt}</p>
          <span className={styles.timestamp}>{timestamp}</span>
        </div>
      </Link>
    </div>
  );
}

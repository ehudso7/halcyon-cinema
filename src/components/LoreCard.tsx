import { LoreEntry } from '@/types';
import styles from './LoreCard.module.css';

interface LoreCardProps {
  entry: LoreEntry;
  onEdit?: (entry: LoreEntry) => void;
  onDelete?: (id: string) => void;
  onLinkScene?: (id: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
  character: '👤',
  location: '🏛️',
  event: '📅',
  system: '⚙️',
};

const TYPE_COLORS: Record<string, string> = {
  character: '#a78bfa',
  location: '#34d399',
  event: '#fbbf24',
  system: '#60a5fa',
};

export default function LoreCard({ entry, onEdit, onDelete, onLinkScene }: LoreCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div
          className={styles.typeIcon}
          style={{ backgroundColor: TYPE_COLORS[entry.type] + '20', color: TYPE_COLORS[entry.type] }}
        >
          {TYPE_ICONS[entry.type]}
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
            🎬 {entry.associatedScenes.length} linked scene{entry.associatedScenes.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <div className={styles.actions}>
        {onLinkScene && (
          <button
            onClick={() => onLinkScene(entry.id)}
            className={styles.actionBtn}
            title="Link to scene"
          >
            🔗
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(entry)}
            className={styles.actionBtn}
            title="Edit entry"
          >
            ✏️
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(entry.id)}
            className={`${styles.actionBtn} ${styles.deleteBtn}`}
            title="Delete entry"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}

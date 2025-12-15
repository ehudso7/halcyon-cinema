import { Character } from '@/types';
import ImageWithFallback from './ImageWithFallback';
import styles from './CharacterCard.module.css';

type ViewMode = 'grid' | 'list';

interface CharacterCardProps {
  character: Character;
  viewMode?: ViewMode;
  isSelected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onShowDetail?: () => void;
  selected?: boolean;
  compact?: boolean;
}

export default function CharacterCard({
  character,
  viewMode = 'grid',
  isSelected = false,
  onSelect,
  onEdit,
  onDelete,
  onShowDetail,
  selected,
  compact,
}: CharacterCardProps) {
  const appearanceCount = character.appearances.length;

  // Compact mode for selection lists
  if (compact) {
    return (
      <button
        onClick={onSelect}
        className={`${styles.compactCard} ${selected ? styles.selected : ''}`}
      >
        <ImageWithFallback
          src={character.imageUrl}
          alt={character.name}
          className={styles.compactImage}
          width={32}
          height={32}
          fallbackType="character"
          showExpiredMessage={false}
        />
        <span className={styles.compactName}>{character.name}</span>
        {selected && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </button>
    );
  }

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

        <div className={styles.listAvatar} onClick={onShowDetail}>
          <ImageWithFallback
            src={character.imageUrl}
            alt={character.name}
            width={48}
            height={48}
            className={styles.avatar}
            fallbackType="character"
          />
        </div>

        <div className={styles.listContent} onClick={onShowDetail}>
          <div className={styles.listHeader}>
            <h3 className={styles.name}>{character.name}</h3>
            <span className={styles.appearances}>
              {appearanceCount} {appearanceCount === 1 ? 'appearance' : 'appearances'}
            </span>
          </div>
          <p className={styles.listDescription}>{character.description}</p>
          {character.traits.length > 0 && (
            <div className={styles.listTraits}>
              {character.traits.slice(0, 3).map((trait, i) => (
                <span key={i} className={styles.trait}>{trait}</span>
              ))}
              {character.traits.length > 3 && (
                <span className={styles.moreTraits}>+{character.traits.length - 3}</span>
              )}
            </div>
          )}
        </div>

        <div className={styles.listActions}>
          {onEdit && (
            <button onClick={onEdit} className={styles.actionBtn} title="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Delete">
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

      <div className={styles.card} onClick={onShowDetail}>
        <div className={styles.header}>
          <ImageWithFallback
            src={character.imageUrl}
            alt={character.name}
            className={styles.avatar}
            width={56}
            height={56}
            fallbackType="character"
          />
          <div className={styles.info}>
            <h3 className={styles.name}>{character.name}</h3>
            <span className={styles.appearances}>
              {appearanceCount} {appearanceCount === 1 ? 'appearance' : 'appearances'}
            </span>
          </div>
        </div>

        <p className={styles.description}>{character.description}</p>

        {character.traits.length > 0 && (
          <div className={styles.traits}>
            {character.traits.map((trait, i) => (
              <span key={i} className={styles.trait}>{trait}</span>
            ))}
          </div>
        )}
      </div>

      {(onEdit || onDelete) && (
        <div className={styles.cardActions}>
          {onEdit && (
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className={styles.actionBtn} title="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Delete">
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

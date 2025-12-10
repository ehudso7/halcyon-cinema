import Image from 'next/image';
import { Character } from '@/types';
import styles from './CharacterCard.module.css';

interface CharacterCardProps {
  character: Character;
  onEdit?: () => void;
  onDelete?: () => void;
  selected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}

export default function CharacterCard({
  character,
  onEdit,
  onDelete,
  selected,
  onSelect,
  compact,
}: CharacterCardProps) {
  const appearanceCount = character.appearances.length;

  if (compact) {
    return (
      <button
        onClick={onSelect}
        className={`${styles.compactCard} ${selected ? styles.selected : ''}`}
      >
        {character.imageUrl ? (
          <Image
            src={character.imageUrl}
            alt={character.name}
            className={styles.compactImage}
            width={32}
            height={32}
          />
        ) : (
          <div className={styles.compactPlaceholder}>
            {character.name[0].toUpperCase()}
          </div>
        )}
        <span className={styles.compactName}>{character.name}</span>
        {selected && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        {character.imageUrl ? (
          <Image
            src={character.imageUrl}
            alt={character.name}
            className={styles.avatar}
            width={48}
            height={48}
          />
        ) : (
          <div className={styles.avatarPlaceholder}>
            {character.name[0].toUpperCase()}
          </div>
        )}
        <div className={styles.info}>
          <h3 className={styles.name}>{character.name}</h3>
          <span className={styles.appearances}>
            {appearanceCount} {appearanceCount === 1 ? 'appearance' : 'appearances'}
          </span>
        </div>
        {(onEdit || onDelete) && (
          <div className={styles.actions}>
            {onEdit && (
              <button onClick={onEdit} className={styles.actionBtn} title="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} className={styles.actionBtn} title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            )}
          </div>
        )}
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
  );
}

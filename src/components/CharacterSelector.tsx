import { Character } from '@/types';
import CharacterCard from './CharacterCard';
import styles from './CharacterSelector.module.css';

interface CharacterSelectorProps {
  characters: Character[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export default function CharacterSelector({
  characters,
  selectedIds,
  onSelectionChange,
}: CharacterSelectorProps) {
  const handleToggle = (characterId: string) => {
    if (selectedIds.includes(characterId)) {
      onSelectionChange(selectedIds.filter(id => id !== characterId));
    } else {
      onSelectionChange([...selectedIds, characterId]);
    }
  };

  if (characters.length === 0) {
    return null;
  }

  return (
    <div className={styles.selector}>
      <label className={styles.label}>
        Tag Characters in This Scene
      </label>
      <div className={styles.list}>
        {characters.map(character => (
          <CharacterCard
            key={character.id}
            character={character}
            compact
            selected={selectedIds.includes(character.id)}
            onSelect={() => handleToggle(character.id)}
          />
        ))}
      </div>
    </div>
  );
}

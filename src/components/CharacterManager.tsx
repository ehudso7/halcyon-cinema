import { useState, FormEvent } from 'react';
import { Character } from '@/types';
import CharacterCard from './CharacterCard';
import styles from './CharacterManager.module.css';

interface CharacterManagerProps {
  characters: Character[];
  onAddCharacter: (character: Omit<Character, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'appearances'>) => void;
  onUpdateCharacter: (id: string, updates: Partial<Character>) => void;
  onDeleteCharacter: (id: string) => void;
}

export default function CharacterManager({
  characters,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
}: CharacterManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [traits, setTraits] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const resetForm = () => {
    setName('');
    setDescription('');
    setTraits('');
    setImageUrl('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const characterData = {
      name: name.trim(),
      description: description.trim(),
      traits: traits.split(',').map(t => t.trim()).filter(Boolean),
      imageUrl: imageUrl.trim() || undefined,
    };

    if (editingId) {
      onUpdateCharacter(editingId, characterData);
    } else {
      onAddCharacter(characterData);
    }

    resetForm();
  };

  const handleEdit = (character: Character) => {
    setEditingId(character.id);
    setName(character.name);
    setDescription(character.description);
    setTraits(character.traits.join(', '));
    setImageUrl(character.imageUrl || '');
    setIsAdding(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this character?')) {
      onDeleteCharacter(id);
    }
  };

  return (
    <div className={styles.manager}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
          Characters ({characters.length})
        </h2>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Character
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <h3 className={styles.formTitle}>
            {editingId ? 'Edit Character' : 'New Character'}
          </h3>

          <div className={styles.field}>
            <label htmlFor="charName" className={styles.label}>Name *</label>
            <input
              id="charName"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Character name"
              className="input"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="charDesc" className={styles.label}>Description *</label>
            <textarea
              id="charDesc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Physical appearance, personality, role in story..."
              className="input textarea"
              rows={3}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="charTraits" className={styles.label}>Traits</label>
            <input
              id="charTraits"
              type="text"
              value={traits}
              onChange={e => setTraits(e.target.value)}
              placeholder="brave, mysterious, scarred (comma-separated)"
              className="input"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="charImage" className={styles.label}>Image URL</label>
            <input
              id="charImage"
              type="url"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://example.com/character.jpg"
              className="input"
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={resetForm} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update' : 'Add'} Character
            </button>
          </div>
        </form>
      )}

      {characters.length > 0 ? (
        <div className={styles.grid}>
          {characters.map(character => (
            <CharacterCard
              key={character.id}
              character={character}
              onEdit={() => handleEdit(character)}
              onDelete={() => handleDelete(character.id)}
            />
          ))}
        </div>
      ) : !isAdding && (
        <div className={styles.empty}>
          <p>No characters yet. Add characters to track them across scenes.</p>
        </div>
      )}
    </div>
  );
}

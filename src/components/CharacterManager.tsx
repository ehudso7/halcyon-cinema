import { useState, FormEvent } from 'react';
import { Character, Scene } from '@/types';
import CharacterCard from './CharacterCard';
import styles from './CharacterManager.module.css';

type ViewMode = 'grid' | 'list';

interface CharacterManagerProps {
  characters: Character[];
  onAddCharacter: (character: Omit<Character, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'appearances'>) => void;
  onUpdateCharacter: (id: string, updates: Partial<Character>) => void;
  onDeleteCharacter: (character: Character) => void;
  viewMode?: ViewMode;
  selectedCharacters?: Set<string>;
  onToggleSelect?: (id: string) => void;
  isAddingCharacter?: boolean;
  setIsAddingCharacter?: (value: boolean) => void;
  scenes?: Scene[];
}

export default function CharacterManager({
  characters,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
  viewMode = 'grid',
  selectedCharacters = new Set(),
  onToggleSelect,
  isAddingCharacter = false,
  setIsAddingCharacter,
  scenes = [],
}: CharacterManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [traits, setTraits] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showDetailModal, setShowDetailModal] = useState<Character | null>(null);

  // Sync with parent state
  const showForm = isAddingCharacter || isAdding;

  const resetForm = () => {
    setName('');
    setDescription('');
    setTraits('');
    setImageUrl('');
    setIsAdding(false);
    setEditingId(null);
    setIsAddingCharacter?.(false);
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
    setIsAddingCharacter?.(true);
  };

  const handleDelete = (character: Character) => {
    onDeleteCharacter(character);
  };

  const handleShowDetail = (character: Character) => {
    setShowDetailModal(character);
  };

  // Get scenes where character appears
  const getCharacterScenes = (character: Character) => {
    return scenes.filter(scene =>
      character.appearances.some(a => a.sceneId === scene.id)
    );
  };

  const startAdding = () => {
    setIsAdding(true);
    setIsAddingCharacter?.(true);
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
        {!showForm && (
          <button onClick={startAdding} className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Character
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formHeader}>
            <h3 className={styles.formTitle}>
              {editingId ? 'Edit Character' : 'New Character'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className={styles.closeBtn}
              title="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formMain}>
              <div className={styles.field}>
                <label htmlFor="charName" className={styles.label}>
                  Name <span className={styles.required}>*</span>
                </label>
                <input
                  id="charName"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Sarah Connor"
                  className="input"
                  required
                  autoFocus
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="charDesc" className={styles.label}>
                  Description <span className={styles.required}>*</span>
                </label>
                <textarea
                  id="charDesc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Physical appearance, personality, role in story..."
                  className="input textarea"
                  rows={4}
                  required
                />
                <p className={styles.fieldHint}>
                  This description will be used when generating scenes with this character.
                </p>
              </div>

              <div className={styles.field}>
                <label htmlFor="charTraits" className={styles.label}>Personality Traits</label>
                <input
                  id="charTraits"
                  type="text"
                  value={traits}
                  onChange={e => setTraits(e.target.value)}
                  placeholder="e.g., brave, mysterious, scarred (comma-separated)"
                  className="input"
                />
                <p className={styles.fieldHint}>
                  Separate traits with commas
                </p>
              </div>
            </div>

            <div className={styles.formSidebar}>
              <div className={styles.field}>
                <label htmlFor="charImage" className={styles.label}>Reference Image</label>
                <div className={styles.imagePreview}>
                  {imageUrl ? (
                    <img src={imageUrl} alt="Preview" />
                  ) : (
                    <div className={styles.imagePlaceholder}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      <span>No image</span>
                    </div>
                  )}
                </div>
                <input
                  id="charImage"
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://example.com/character.jpg"
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={resetForm} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim() || !description.trim()}>
              {editingId ? 'Update' : 'Create'} Character
            </button>
          </div>
        </form>
      )}

      {characters.length > 0 ? (
        <div className={viewMode === 'grid' ? styles.grid : styles.list}>
          {characters.map(character => (
            <CharacterCard
              key={character.id}
              character={character}
              viewMode={viewMode}
              isSelected={selectedCharacters.has(character.id)}
              onSelect={() => onToggleSelect?.(character.id)}
              onEdit={() => handleEdit(character)}
              onDelete={() => handleDelete(character)}
              onShowDetail={() => handleShowDetail(character)}
            />
          ))}
        </div>
      ) : !showForm && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h3>No characters yet</h3>
          <p>Create characters to track their appearances across your scenes and maintain visual consistency.</p>
          <button onClick={startAdding} className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create Your First Character
          </button>
        </div>
      )}

      {/* Character Detail Modal */}
      {showDetailModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDetailModal(null)}>
          <div className={styles.detailModal} onClick={e => e.stopPropagation()}>
            <button
              className={styles.modalClose}
              onClick={() => setShowDetailModal(null)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className={styles.detailContent}>
              <div className={styles.detailHeader}>
                {showDetailModal.imageUrl ? (
                  <img
                    src={showDetailModal.imageUrl}
                    alt={showDetailModal.name}
                    className={styles.detailImage}
                  />
                ) : (
                  <div className={styles.detailPlaceholder}>
                    {showDetailModal.name[0].toUpperCase()}
                  </div>
                )}
                <div className={styles.detailInfo}>
                  <h2>{showDetailModal.name}</h2>
                  <div className={styles.detailStats}>
                    <span>{showDetailModal.appearances.length} appearance{showDetailModal.appearances.length !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{showDetailModal.traits.length} trait{showDetailModal.traits.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>

              <div className={styles.detailSection}>
                <h4>Description</h4>
                <p>{showDetailModal.description}</p>
              </div>

              {showDetailModal.traits.length > 0 && (
                <div className={styles.detailSection}>
                  <h4>Traits</h4>
                  <div className={styles.traitsList}>
                    {showDetailModal.traits.map((trait, i) => (
                      <span key={i} className={styles.traitTag}>{trait}</span>
                    ))}
                  </div>
                </div>
              )}

              {showDetailModal.appearances.length > 0 && (
                <div className={styles.detailSection}>
                  <h4>Scene Appearances</h4>
                  <div className={styles.scenesList}>
                    {getCharacterScenes(showDetailModal).map(scene => (
                      <div key={scene.id} className={styles.sceneItem}>
                        <div className={styles.sceneThumbnail}>
                          {scene.imageUrl ? (
                            <img src={scene.imageUrl} alt={scene.prompt.slice(0, 30)} />
                          ) : (
                            <div className={styles.scenePlaceholder}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className={styles.sceneInfo}>
                          <p className={styles.scenePrompt}>{scene.prompt.slice(0, 80)}...</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.detailActions}>
                <button
                  className="btn btn-secondary"
                  onClick={() => { handleEdit(showDetailModal); setShowDetailModal(null); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Character
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => { handleDelete(showDetailModal); setShowDetailModal(null); }}
                  style={{ color: 'var(--color-error)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

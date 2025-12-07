import { useState, FormEvent } from 'react';
import { LoreType, LoreEntry } from '@/types';
import styles from './AddLoreModal.module.css';

interface AddLoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<LoreEntry, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>) => void;
  editEntry?: LoreEntry | null;
}

const LORE_TYPES: { value: LoreType; label: string; icon: string; description: string }[] = [
  { value: 'character', label: 'Character', icon: '👤', description: 'A person, creature, or entity in your world' },
  { value: 'location', label: 'Location', icon: '🏛️', description: 'A place, setting, or environment' },
  { value: 'event', label: 'Event', icon: '📅', description: 'A historical moment, battle, or occurrence' },
  { value: 'system', label: 'System', icon: '⚙️', description: 'Magic systems, technology, or rules of your world' },
];

export default function AddLoreModal({ isOpen, onClose, onSave, editEntry }: AddLoreModalProps) {
  const [type, setType] = useState<LoreType>(editEntry?.type || 'character');
  const [name, setName] = useState(editEntry?.name || '');
  const [summary, setSummary] = useState(editEntry?.summary || '');
  const [description, setDescription] = useState(editEntry?.description || '');
  const [tagsInput, setTagsInput] = useState(editEntry?.tags?.join(', ') || '');

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const tags = tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    onSave({
      type,
      name,
      summary,
      description: description || undefined,
      tags,
      associatedScenes: editEntry?.associatedScenes || [],
    });

    // Reset form
    setType('character');
    setName('');
    setSummary('');
    setDescription('');
    setTagsInput('');
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{editEntry ? 'Edit Lore Entry' : 'New Lore Entry'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Type</label>
            <div className={styles.typeGrid}>
              {LORE_TYPES.map(loreType => (
                <button
                  key={loreType.value}
                  type="button"
                  className={`${styles.typeOption} ${type === loreType.value ? styles.selected : ''}`}
                  onClick={() => setType(loreType.value)}
                >
                  <span className={styles.typeIcon}>{loreType.icon}</span>
                  <span className={styles.typeLabel}>{loreType.label}</span>
                </button>
              ))}
            </div>
            <p className={styles.typeDescription}>
              {LORE_TYPES.find(t => t.value === type)?.description}
            </p>
          </div>

          <div className={styles.field}>
            <label htmlFor="name" className={styles.label}>Name *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Captain Elena Voss, The Shadowlands, The Great War"
              className="input"
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="summary" className={styles.label}>Summary *</label>
            <textarea
              id="summary"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="A brief overview (1-2 sentences)"
              className="input"
              rows={2}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="description" className={styles.label}>
              Description <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detailed backstory, history, or additional notes..."
              className="input"
              rows={4}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="tags" className={styles.label}>
              Tags <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="tags"
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="hero, protagonist, act-1 (comma separated)"
              className="input"
            />
          </div>

          <div className={styles.actions}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editEntry ? 'Save Changes' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

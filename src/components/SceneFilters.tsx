import { useState, useEffect, useCallback } from 'react';
import { Scene, Character } from '@/types';
import styles from './SceneFilters.module.css';

interface SceneFiltersProps {
  scenes: Scene[];
  characters?: Character[];
  onFilterChange: (filteredScenes: Scene[]) => void;
}

const SHOT_TYPES = [
  { value: '', label: 'All Shot Types' },
  { value: 'wide', label: 'Wide Shot' },
  { value: 'medium', label: 'Medium Shot' },
  { value: 'close-up', label: 'Close-Up' },
  { value: 'extreme close-up', label: 'Extreme Close-Up' },
  { value: 'aerial', label: 'Aerial/Drone' },
  { value: 'low-angle', label: 'Low Angle' },
  { value: 'high-angle', label: 'High Angle' },
  { value: 'establishing', label: 'Establishing Shot' },
];

const LIGHTING = [
  { value: '', label: 'All Lighting' },
  { value: 'natural', label: 'Natural' },
  { value: 'golden hour', label: 'Golden Hour' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'soft', label: 'Soft/Diffused' },
  { value: 'harsh', label: 'Harsh' },
  { value: 'backlighting', label: 'Backlighting' },
  { value: 'neon', label: 'Neon' },
  { value: 'candlelight', label: 'Candlelight' },
];

const MOODS = [
  { value: '', label: 'All Moods' },
  { value: 'epic', label: 'Epic' },
  { value: 'mysterious', label: 'Mysterious' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'tense', label: 'Tense/Suspenseful' },
  { value: 'peaceful', label: 'Peaceful' },
  { value: 'melancholic', label: 'Melancholic' },
  { value: 'joyful', label: 'Joyful' },
  { value: 'dark', label: 'Dark' },
];

export default function SceneFilters({ scenes, characters = [], onFilterChange }: SceneFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [shotType, setShotType] = useState('');
  const [lighting, setLighting] = useState('');
  const [mood, setMood] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = searchTerm || shotType || lighting || mood || characterId;

  const filterScenes = useCallback(() => {
    let filtered = [...scenes];

    // Search term filter (searches prompt)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(scene =>
        scene.prompt.toLowerCase().includes(term)
      );
    }

    // Shot type filter
    if (shotType) {
      filtered = filtered.filter(scene =>
        scene.metadata?.shotType === shotType
      );
    }

    // Lighting filter
    if (lighting) {
      filtered = filtered.filter(scene =>
        scene.metadata?.lighting === lighting
      );
    }

    // Mood filter
    if (mood) {
      filtered = filtered.filter(scene =>
        scene.metadata?.mood === mood
      );
    }

    // Character filter
    if (characterId) {
      filtered = filtered.filter(scene =>
        scene.characterIds?.includes(characterId)
      );
    }

    onFilterChange(filtered);
  }, [scenes, searchTerm, shotType, lighting, mood, characterId, onFilterChange]);

  useEffect(() => {
    filterScenes();
  }, [filterScenes]);

  const clearFilters = () => {
    setSearchTerm('');
    setShotType('');
    setLighting('');
    setMood('');
    setCharacterId('');
  };

  return (
    <div className={styles.filters}>
      <div className={styles.searchRow}>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search scenes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          {searchTerm && (
            <button
              className={styles.clearSearch}
              onClick={() => setSearchTerm('')}
              title="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <button
          className={`${styles.filterToggle} ${isExpanded ? styles.active : ''}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="6" y1="12" x2="18" y2="12" />
            <line x1="8" y1="18" x2="16" y2="18" />
          </svg>
          Filters
          {hasActiveFilters && <span className={styles.filterBadge} />}
        </button>

        {hasActiveFilters && (
          <button className={styles.clearAll} onClick={clearFilters}>
            Clear All
          </button>
        )}
      </div>

      {isExpanded && (
        <div className={styles.filterGrid}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Shot Type</label>
            <select
              value={shotType}
              onChange={(e) => setShotType(e.target.value)}
              className={styles.filterSelect}
            >
              {SHOT_TYPES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Lighting</label>
            <select
              value={lighting}
              onChange={(e) => setLighting(e.target.value)}
              className={styles.filterSelect}
            >
              {LIGHTING.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Mood</label>
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              className={styles.filterSelect}
            >
              {MOODS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {characters.length > 0 && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Character</label>
              <select
                value={characterId}
                onChange={(e) => setCharacterId(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">All Characters</option>
                {characters.map(char => (
                  <option key={char.id} value={char.id}>{char.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

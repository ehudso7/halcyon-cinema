import { useState, useEffect, useRef } from 'react';
import styles from './GenerationControls.module.css';

export interface GenerationSettings {
  // Core generation parameters
  creativity: number; // 0-100, maps to temperature
  detail: number; // 0-100, affects prompt enhancement
  styleStrength: number; // 0-100, how strongly to apply style

  // Taste preferences
  colorPalette: 'vibrant' | 'muted' | 'warm' | 'cool' | 'neutral';
  composition: 'balanced' | 'dynamic' | 'minimalist' | 'complex';
  mood: 'light' | 'dark' | 'neutral' | 'dramatic';

  // Presets
  preset: string | null;
}

interface GenerationControlsProps {
  settings: GenerationSettings;
  onChange: (settings: GenerationSettings) => void;
  onSavePreset?: (name: string, settings: GenerationSettings) => void;
  savedPresets?: Array<{ name: string; settings: GenerationSettings }>;
  compact?: boolean;
}

const DEFAULT_SETTINGS: GenerationSettings = {
  creativity: 50,
  detail: 50,
  styleStrength: 50,
  colorPalette: 'neutral',
  composition: 'balanced',
  mood: 'neutral',
  preset: null,
};

const BUILT_IN_PRESETS = [
  {
    name: 'Photorealistic',
    settings: { creativity: 30, detail: 80, styleStrength: 70, colorPalette: 'neutral' as const, composition: 'balanced' as const, mood: 'neutral' as const, preset: 'Photorealistic' },
  },
  {
    name: 'Artistic',
    settings: { creativity: 80, detail: 60, styleStrength: 90, colorPalette: 'vibrant' as const, composition: 'dynamic' as const, mood: 'dramatic' as const, preset: 'Artistic' },
  },
  {
    name: 'Cinematic',
    settings: { creativity: 50, detail: 90, styleStrength: 80, colorPalette: 'warm' as const, composition: 'dynamic' as const, mood: 'dramatic' as const, preset: 'Cinematic' },
  },
  {
    name: 'Minimalist',
    settings: { creativity: 40, detail: 30, styleStrength: 40, colorPalette: 'muted' as const, composition: 'minimalist' as const, mood: 'light' as const, preset: 'Minimalist' },
  },
  {
    name: 'Dark & Moody',
    settings: { creativity: 60, detail: 70, styleStrength: 85, colorPalette: 'cool' as const, composition: 'dynamic' as const, mood: 'dark' as const, preset: 'Dark & Moody' },
  },
];

export default function GenerationControls({
  settings,
  onChange,
  onSavePreset,
  savedPresets = [],
  compact = false,
}: GenerationControlsProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [newPresetName, setNewPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Use ref to avoid infinite re-render loop when calling onChange
  const onChangeRef = useRef(onChange);

  // Keep ref in sync with latest onChange callback
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('generation_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        onChangeRef.current({ ...DEFAULT_SETTINGS, ...parsed });
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  // Save settings to localStorage when changed
  useEffect(() => {
    localStorage.setItem('generation_settings', JSON.stringify(settings));
  }, [settings]);

  const handleSliderChange = (key: keyof GenerationSettings, value: number) => {
    onChange({
      ...settings,
      [key]: value,
      preset: null, // Clear preset when manually adjusting
    });
  };

  const handleSelectChange = (key: keyof GenerationSettings, value: string) => {
    onChange({
      ...settings,
      [key]: value,
      preset: null,
    });
  };

  const handlePresetChange = (presetName: string) => {
    const allPresets = [...BUILT_IN_PRESETS, ...savedPresets];
    const preset = allPresets.find(p => p.name === presetName);
    if (preset) {
      onChange(preset.settings);
    }
  };

  const handleSavePreset = () => {
    if (newPresetName.trim() && onSavePreset) {
      onSavePreset(newPresetName.trim(), { ...settings, preset: newPresetName.trim() });
      setNewPresetName('');
      setShowSavePreset(false);
    }
  };

  const handleReset = () => {
    onChange(DEFAULT_SETTINGS);
  };

  const allPresets = [...BUILT_IN_PRESETS, ...savedPresets];

  if (compact && !isExpanded) {
    return (
      <div className={styles.compactBar}>
        <div className={styles.compactInfo}>
          <span className={styles.compactLabel}>Generation Style:</span>
          <span className={styles.compactValue}>
            {settings.preset || 'Custom'}
          </span>
        </div>
        <button
          className={styles.expandBtn}
          onClick={() => setIsExpanded(true)}
          title="Show generation controls"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Adjust
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Generation Controls
        </h3>
        <div className={styles.headerActions}>
          <button className={styles.resetBtn} onClick={handleReset} title="Reset to defaults">
            Reset
          </button>
          {compact && (
            <button className={styles.collapseBtn} onClick={() => setIsExpanded(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Presets */}
      <div className={styles.section}>
        <label className={styles.label}>Quick Preset</label>
        <div className={styles.presets}>
          {allPresets.map((preset) => (
            <button
              key={preset.name}
              className={`${styles.presetBtn} ${settings.preset === preset.name ? styles.active : ''}`}
              onClick={() => handlePresetChange(preset.name)}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className={styles.sliders}>
        <div className={styles.sliderGroup}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Creativity</label>
            <span className={styles.value}>{settings.creativity}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.creativity}
            onChange={(e) => handleSliderChange('creativity', parseInt(e.target.value))}
            className={styles.slider}
          />
          <div className={styles.sliderLabels}>
            <span>Conservative</span>
            <span>Experimental</span>
          </div>
        </div>

        <div className={styles.sliderGroup}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Detail Level</label>
            <span className={styles.value}>{settings.detail}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.detail}
            onChange={(e) => handleSliderChange('detail', parseInt(e.target.value))}
            className={styles.slider}
          />
          <div className={styles.sliderLabels}>
            <span>Simple</span>
            <span>Intricate</span>
          </div>
        </div>

        <div className={styles.sliderGroup}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Style Strength</label>
            <span className={styles.value}>{settings.styleStrength}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.styleStrength}
            onChange={(e) => handleSliderChange('styleStrength', parseInt(e.target.value))}
            className={styles.slider}
          />
          <div className={styles.sliderLabels}>
            <span>Subtle</span>
            <span>Bold</span>
          </div>
        </div>
      </div>

      {/* Dropdowns */}
      <div className={styles.dropdowns}>
        <div className={styles.selectGroup}>
          <label className={styles.label}>Color Palette</label>
          <select
            value={settings.colorPalette}
            onChange={(e) => handleSelectChange('colorPalette', e.target.value)}
            className={styles.select}
          >
            <option value="neutral">Neutral</option>
            <option value="vibrant">Vibrant</option>
            <option value="muted">Muted</option>
            <option value="warm">Warm</option>
            <option value="cool">Cool</option>
          </select>
        </div>

        <div className={styles.selectGroup}>
          <label className={styles.label}>Composition</label>
          <select
            value={settings.composition}
            onChange={(e) => handleSelectChange('composition', e.target.value)}
            className={styles.select}
          >
            <option value="balanced">Balanced</option>
            <option value="dynamic">Dynamic</option>
            <option value="minimalist">Minimalist</option>
            <option value="complex">Complex</option>
          </select>
        </div>

        <div className={styles.selectGroup}>
          <label className={styles.label}>Mood</label>
          <select
            value={settings.mood}
            onChange={(e) => handleSelectChange('mood', e.target.value)}
            className={styles.select}
          >
            <option value="neutral">Neutral</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="dramatic">Dramatic</option>
          </select>
        </div>
      </div>

      {/* Save Preset */}
      {onSavePreset && (
        <div className={styles.savePreset}>
          {showSavePreset ? (
            <div className={styles.savePresetForm}>
              <input
                type="text"
                placeholder="Preset name..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className={styles.presetInput}
              />
              <button
                className={styles.saveBtn}
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
              >
                Save
              </button>
              <button
                className={styles.cancelBtn}
                onClick={() => {
                  setShowSavePreset(false);
                  setNewPresetName('');
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className={styles.savePresetBtn}
              onClick={() => setShowSavePreset(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Save as Preset
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { DEFAULT_SETTINGS };

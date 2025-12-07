import { useState, FormEvent } from 'react';
import styles from './PromptBuilder.module.css';

interface PromptBuilderProps {
  onSubmit: (data: PromptData) => void;
  isLoading?: boolean;
  initialPrompt?: string;
}

export interface PromptData {
  prompt: string;
  shotType?: string;
  style?: string;
  lighting?: string;
  mood?: string;
  aspectRatio?: string;
}

const SHOT_TYPES = [
  { value: '', label: 'Any' },
  { value: 'wide', label: 'Wide Shot' },
  { value: 'medium', label: 'Medium Shot' },
  { value: 'close-up', label: 'Close-Up' },
  { value: 'extreme close-up', label: 'Extreme Close-Up' },
  { value: 'aerial', label: 'Aerial/Drone' },
  { value: 'low-angle', label: 'Low Angle' },
  { value: 'high-angle', label: 'High Angle' },
  { value: 'establishing', label: 'Establishing Shot' },
];

const STYLES = [
  { value: '', label: 'Any' },
  { value: 'photorealistic', label: 'Photorealistic' },
  { value: 'cinematic film', label: 'Cinematic Film' },
  { value: 'noir', label: 'Film Noir' },
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'anime', label: 'Anime' },
  { value: 'oil painting', label: 'Oil Painting' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'concept art', label: 'Concept Art' },
];

const LIGHTING = [
  { value: '', label: 'Any' },
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
  { value: '', label: 'Any' },
  { value: 'epic', label: 'Epic' },
  { value: 'mysterious', label: 'Mysterious' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'tense', label: 'Tense/Suspenseful' },
  { value: 'peaceful', label: 'Peaceful' },
  { value: 'melancholic', label: 'Melancholic' },
  { value: 'joyful', label: 'Joyful' },
  { value: 'dark', label: 'Dark' },
];

const ASPECT_RATIOS = [
  { value: '1024x1024', label: '1:1 Square' },
  { value: '1792x1024', label: '16:9 Landscape' },
  { value: '1024x1792', label: '9:16 Portrait' },
];

export default function PromptBuilder({ onSubmit, isLoading = false, initialPrompt = '' }: PromptBuilderProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [shotType, setShotType] = useState('');
  const [style, setStyle] = useState('');
  const [lighting, setLighting] = useState('');
  const [mood, setMood] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1024x1024');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError('Please enter a scene description');
      return;
    }

    onSubmit({
      prompt: trimmedPrompt,
      shotType: shotType || undefined,
      style: style || undefined,
      lighting: lighting || undefined,
      mood: mood || undefined,
      aspectRatio,
    });
  };

  return (
    <div className={styles.builder}>
      <form onSubmit={handleSubmit}>
        <div className={styles.mainInput}>
          <label htmlFor="prompt" className={styles.label}>
            Scene Description
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe your scene... e.g., 'A lone samurai standing on a misty mountain peak at dawn, cherry blossoms falling around him'"
            className={`input textarea ${styles.textarea}`}
            rows={4}
            disabled={isLoading}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={styles.advancedToggle}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
          {showAdvanced ? 'Hide' : 'Show'} Advanced Options
        </button>

        {showAdvanced && (
          <div className={styles.advancedOptions}>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label htmlFor="shotType" className={styles.label}>
                  Shot Type
                </label>
                <select
                  id="shotType"
                  value={shotType}
                  onChange={e => setShotType(e.target.value)}
                  className="input"
                  disabled={isLoading}
                >
                  {SHOT_TYPES.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="style" className={styles.label}>
                  Visual Style
                </label>
                <select
                  id="style"
                  value={style}
                  onChange={e => setStyle(e.target.value)}
                  className="input"
                  disabled={isLoading}
                >
                  {STYLES.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="lighting" className={styles.label}>
                  Lighting
                </label>
                <select
                  id="lighting"
                  value={lighting}
                  onChange={e => setLighting(e.target.value)}
                  className="input"
                  disabled={isLoading}
                >
                  {LIGHTING.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="mood" className={styles.label}>
                  Mood
                </label>
                <select
                  id="mood"
                  value={mood}
                  onChange={e => setMood(e.target.value)}
                  className="input"
                  disabled={isLoading}
                >
                  {MOODS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Aspect Ratio</label>
              <div className={styles.ratioButtons}>
                {ASPECT_RATIOS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAspectRatio(option.value)}
                    className={`${styles.ratioButton} ${aspectRatio === option.value ? styles.ratioActive : ''}`}
                    disabled={isLoading}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <button
          type="submit"
          className={`btn btn-primary ${styles.submitButton}`}
          disabled={isLoading || !prompt.trim()}
        >
          {isLoading ? (
            <>
              <span className="spinner" />
              Generating...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Generate Scene
            </>
          )}
        </button>
      </form>
    </div>
  );
}

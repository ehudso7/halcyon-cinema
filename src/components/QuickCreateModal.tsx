import { useState, FormEvent } from 'react';
import styles from './QuickCreateModal.module.css';

interface QuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (data: QuickCreateData) => Promise<void>;
  isGenerating?: boolean;
}

export interface QuickCreateData {
  prompt: string;
  genre: string;
  mood: string;
  sceneCount: number;
}

const GENRES = [
  { value: 'cinematic-realism', label: 'Cinematic Realism' },
  { value: 'film-noir', label: 'Film Noir' },
  { value: 'sci-fi', label: 'Science Fiction' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'anime', label: 'Anime' },
  { value: 'horror', label: 'Horror' },
  { value: 'western', label: 'Western' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'steampunk', label: 'Steampunk' },
  { value: 'documentary', label: 'Documentary' },
];

const MOODS = [
  { value: 'epic', label: 'Epic' },
  { value: 'mysterious', label: 'Mysterious' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'tense', label: 'Tense' },
  { value: 'peaceful', label: 'Peaceful' },
  { value: 'melancholic', label: 'Melancholic' },
  { value: 'joyful', label: 'Joyful' },
  { value: 'dark', label: 'Dark' },
  { value: 'adventurous', label: 'Adventurous' },
  { value: 'nostalgic', label: 'Nostalgic' },
];

const EXAMPLE_PROMPTS = [
  "A detective investigates a missing person case in a rain-soaked city",
  "An astronaut discovers an ancient alien artifact on Mars",
  "A young wizard begins their journey at a magical academy",
  "A samurai seeks redemption after years of wandering",
  "Two strangers meet on a train crossing Europe",
  "A chef competes in an underground cooking competition",
];

export default function QuickCreateModal({
  isOpen,
  onClose,
  onGenerate,
  isGenerating = false,
}: QuickCreateModalProps) {
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('cinematic-realism');
  const [mood, setMood] = useState('epic');
  const [sceneCount, setSceneCount] = useState(5);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError('Please describe your story idea');
      return;
    }

    if (trimmedPrompt.length < 10) {
      setError('Please provide a more detailed description (at least 10 characters)');
      return;
    }

    try {
      await onGenerate({
        prompt: trimmedPrompt,
        genre,
        mood,
        sceneCount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    }
  };

  const handleClose = () => {
    if (!isGenerating) {
      setPrompt('');
      setGenre('cinematic-realism');
      setMood('epic');
      setSceneCount(5);
      setError('');
      onClose();
    }
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
    setError('');
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h2 className={styles.title}>Quick Create</h2>
            <p className={styles.subtitle}>
              Generate a complete cinematic project from a single idea
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="storyPrompt" className={styles.label}>
              Your Story Idea <span className={styles.required}>*</span>
            </label>
            <textarea
              id="storyPrompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your story in a few sentences... e.g., 'A detective investigates a mysterious disappearance in a rain-soaked city'"
              className={styles.textarea}
              rows={4}
              disabled={isGenerating}
              autoFocus
            />
            <div className={styles.examples}>
              <span className={styles.examplesLabel}>Try:</span>
              {EXAMPLE_PROMPTS.slice(0, 3).map((example, i) => (
                <button
                  key={i}
                  type="button"
                  className={styles.exampleChip}
                  onClick={() => handleExampleClick(example)}
                  disabled={isGenerating}
                >
                  {example.length > 40 ? example.slice(0, 40) + '...' : example}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="genre" className={styles.label}>
                Genre
              </label>
              <select
                id="genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className={styles.select}
                disabled={isGenerating}
              >
                {GENRES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
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
                onChange={(e) => setMood(e.target.value)}
                className={styles.select}
                disabled={isGenerating}
              >
                {MOODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="sceneCount" className={styles.label}>
              Number of Scenes: <strong>{sceneCount}</strong>
            </label>
            <input
              id="sceneCount"
              type="range"
              min="3"
              max="10"
              value={sceneCount}
              onChange={(e) => setSceneCount(parseInt(e.target.value))}
              className={styles.slider}
              disabled={isGenerating}
            />
            <div className={styles.sliderLabels}>
              <span>3 (Quick)</span>
              <span>10 (Detailed)</span>
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.preview}>
            <h4>What you'll get:</h4>
            <ul>
              <li>Complete project with {sceneCount} scenes</li>
              <li>Auto-generated characters with descriptions</li>
              <li>World lore and locations</li>
              <li>Consistent {GENRES.find((g) => g.value === genre)?.label} visual style</li>
            </ul>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
              disabled={isGenerating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn-primary ${styles.generateBtn}`}
              disabled={isGenerating || !prompt.trim()}
            >
              {isGenerating ? (
                <>
                  <span className={styles.spinner} />
                  Generating...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Generate Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

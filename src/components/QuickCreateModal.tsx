import { useState, useEffect, FormEvent } from 'react';
import { DocumentIcon, UsersIcon, GlobeIcon, FilmIcon, PaletteIcon, SparklesIcon } from './Icons';
import styles from './QuickCreateModal.module.css';

// Check icon for quality metrics
function CheckIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22,4 12,14.01 9,11.01" />
    </svg>
  );
}

interface QuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (data: QuickCreateData) => Promise<void>;
  isGenerating?: boolean;
  generationStep?: string;
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
  { value: 'a24-indie', label: 'A24 Indie' },
  { value: 'thriller', label: 'Thriller' },
];

const MOODS = [
  { value: 'epic', label: 'Epic', color: '#FFD700' },
  { value: 'mysterious', label: 'Mysterious', color: '#8B5CF6' },
  { value: 'romantic', label: 'Romantic', color: '#EC4899' },
  { value: 'tense', label: 'Tense', color: '#EF4444' },
  { value: 'peaceful', label: 'Peaceful', color: '#10B981' },
  { value: 'melancholic', label: 'Melancholic', color: '#6B7280' },
  { value: 'joyful', label: 'Joyful', color: '#F59E0B' },
  { value: 'dark', label: 'Dark', color: '#1F2937' },
  { value: 'adventurous', label: 'Adventurous', color: '#3B82F6' },
  { value: 'nostalgic', label: 'Nostalgic', color: '#D97706' },
  { value: 'dreamy', label: 'Dreamy', color: '#A78BFA' },
  { value: 'gritty', label: 'Gritty', color: '#78716C' },
];

const EXAMPLE_PROMPTS = [
  "A detective investigates a missing person case in a rain-soaked city where nothing is what it seems",
  "An astronaut discovers an ancient alien artifact on Mars that begins to change her",
  "A young wizard begins their journey at a magical academy hiding dark secrets",
  "A samurai seeks redemption after years of wandering, haunted by past failures",
  "Two strangers meet on a train crossing Europe, each running from their past",
  "A chef competes in an underground cooking competition where losing means everything",
  "An orphaned linguist discovers a machine that speaks in forgotten dreams",
  "A retired spy is pulled back in for one last job that will test everything she believes",
];

const GENERATION_STEPS = [
  { id: 'story', label: 'Weaving narrative threads...', IconComponent: DocumentIcon },
  { id: 'characters', label: 'Breathing life into characters...', IconComponent: UsersIcon },
  { id: 'world', label: 'Building your world...', IconComponent: GlobeIcon },
  { id: 'scenes', label: 'Crafting cinematic scenes...', IconComponent: FilmIcon },
  { id: 'style', label: 'Defining visual language...', IconComponent: PaletteIcon },
  { id: 'polish', label: 'Adding final polish...', IconComponent: SparklesIcon },
];

export default function QuickCreateModal({
  isOpen,
  onClose,
  onGenerate,
  isGenerating = false,
  generationStep,
}: QuickCreateModalProps) {
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('cinematic-realism');
  const [mood, setMood] = useState('epic');
  const [sceneCount, setSceneCount] = useState(5);
  const [error, setError] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Animate through generation steps
  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setCurrentStepIndex((prev) => (prev + 1) % GENERATION_STEPS.length);
      }, 2500);
      return () => clearInterval(interval);
    } else {
      setCurrentStepIndex(0);
    }
  }, [isGenerating]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError('Please describe your story idea');
      return;
    }

    if (trimmedPrompt.length < 20) {
      setError('Please provide a more detailed description (at least 20 characters)');
      return;
    }

    await onGenerate({
      prompt: trimmedPrompt,
      genre,
      mood,
      sceneCount,
    });
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

  const selectedGenre = GENRES.find((g) => g.value === genre);
  const selectedMood = MOODS.find((m) => m.value === mood);

  // Generation in progress view
  if (isGenerating) {
    const currentStep = GENERATION_STEPS[currentStepIndex];
    return (
      <div className={styles.overlay}>
        <div className={`${styles.modal} ${styles.generatingModal}`}>
          <div className={styles.generatingContainer}>
            <div className={styles.generatingAnimation}>
              <div className={styles.pulseRing} />
              <div className={styles.pulseRing} style={{ animationDelay: '0.5s' }} />
              <div className={styles.pulseRing} style={{ animationDelay: '1s' }} />
              <div className={styles.generatingIcon}>
                <span className={styles.stepIcon}><currentStep.IconComponent size={32} color="#6366f1" /></span>
              </div>
            </div>

            <h2 className={styles.generatingTitle}>Creating Your Cinematic World</h2>
            <p className={styles.generatingStep}>{generationStep || currentStep.label}</p>

            <div className={styles.progressSteps}>
              {GENERATION_STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={`${styles.progressStep} ${
                    index < currentStepIndex ? styles.completed :
                    index === currentStepIndex ? styles.active : ''
                  }`}
                >
                  <span className={styles.progressDot} />
                </div>
              ))}
            </div>

            <div className={styles.generatingPreview}>
              <p className={styles.previewPrompt}>&ldquo;{prompt.slice(0, 100)}{prompt.length > 100 ? '...' : ''}&rdquo;</p>
              <div className={styles.previewTags}>
                <span className={styles.previewTag}>{selectedGenre?.label}</span>
                <span className={styles.previewTag} style={{ borderColor: selectedMood?.color }}>{selectedMood?.label}</span>
                <span className={styles.previewTag}>{sceneCount} Scenes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={handleClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <h2 className={styles.title}>Quick Create</h2>
            <p className={styles.subtitle}>
              One prompt. Complete cinematic project. Studio-ready quality.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="storyPrompt" className={styles.label}>
              Your Story Seed <span className={styles.required}>*</span>
            </label>
            <textarea
              id="storyPrompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your story in a few sentences... The AI will expand this into a complete cinematic project with characters, scenes, world lore, and more."
              className={styles.textarea}
              rows={4}
              disabled={isGenerating}
              autoFocus
            />
            <div className={styles.examples}>
              <span className={styles.examplesLabel}>Try one:</span>
              <div className={styles.exampleChips}>
                {EXAMPLE_PROMPTS.slice(0, 4).map((example, i) => (
                  <button
                    key={i}
                    type="button"
                    className={styles.exampleChip}
                    onClick={() => handleExampleClick(example)}
                    disabled={isGenerating}
                  >
                    {example.length > 50 ? example.slice(0, 50) + '...' : example}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Genre</label>
              <div className={styles.genreGrid}>
                {GENRES.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    className={`${styles.genreOption} ${genre === g.value ? styles.selected : ''}`}
                    onClick={() => setGenre(g.value)}
                    disabled={isGenerating}
                  >
                    <span className={styles.genreLabel}>{g.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Mood</label>
              <div className={styles.moodGrid}>
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={`${styles.moodOption} ${mood === m.value ? styles.selected : ''}`}
                    onClick={() => setMood(m.value)}
                    disabled={isGenerating}
                    style={{ '--mood-color': m.color } as React.CSSProperties}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="sceneCount" className={styles.label}>
              Scenes: <strong>{sceneCount}</strong>
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
              <span>10 (Epic)</span>
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.deliverables}>
            <h4 className={styles.deliverablesTitle}>Your Cinematic Package Includes:</h4>
            <div className={styles.deliverablesList}>
              <div className={styles.deliverable}>
                <span className={styles.deliverableIcon}><DocumentIcon size={20} color="#6366f1" /></span>
                <div>
                  <strong>Logline & Tagline</strong>
                  <span>Marketable pitch materials</span>
                </div>
              </div>
              <div className={styles.deliverable}>
                <span className={styles.deliverableIcon}><FilmIcon size={20} color="#6366f1" /></span>
                <div>
                  <strong>{sceneCount} Screenplay Scenes</strong>
                  <span>With sluglines & action</span>
                </div>
              </div>
              <div className={styles.deliverable}>
                <span className={styles.deliverableIcon}><UsersIcon size={20} color="#6366f1" /></span>
                <div>
                  <strong>Character Profiles</strong>
                  <span>Arcs, traits & visuals</span>
                </div>
              </div>
              <div className={styles.deliverable}>
                <span className={styles.deliverableIcon}><GlobeIcon size={20} color="#6366f1" /></span>
                <div>
                  <strong>World Lore</strong>
                  <span>Locations, events & systems</span>
                </div>
              </div>
              <div className={styles.deliverable}>
                <span className={styles.deliverableIcon}><PaletteIcon size={20} color="#6366f1" /></span>
                <div>
                  <strong>Visual Style Guide</strong>
                  <span>Colors, lighting & motifs</span>
                </div>
              </div>
              <div className={styles.deliverable}>
                <span className={styles.deliverableIcon}><CheckIcon size={20} color="#10b981" /></span>
                <div>
                  <strong>Quality Metrics</strong>
                  <span>Professional grade scoring</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleClose}
              className={`btn btn-secondary ${styles.cancelBtn}`}
              disabled={isGenerating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn-primary ${styles.generateBtn}`}
              disabled={isGenerating || !prompt.trim()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Generate Cinematic Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

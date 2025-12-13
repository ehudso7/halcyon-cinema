import { useState, useEffect, FormEvent } from 'react';
import VisualStyleSelector, { getStyleModifier } from './VisualStyleSelector';
import CharacterSelector from './CharacterSelector';
import { getCreditsRemaining, invalidateCreditsCache } from './UsageStats';
import { Character } from '@/types';
import { PaletteIcon } from './Icons';
import styles from './PromptBuilder.module.css';

interface PromptBuilderProps {
  onSubmit: (data: PromptData) => void;
  isLoading?: boolean;
  initialPrompt?: string;
  onPromptChange?: (prompt: string) => void;
  characters?: Character[];
  initialCharacterIds?: string[];
}

export type ContentType = 'image' | 'video';

export interface PromptData {
  prompt: string;
  contentType: ContentType;
  shotType?: string;
  style?: string;
  lighting?: string;
  mood?: string;
  aspectRatio?: string;
  visualStyleId?: string;
  characterIds?: string[];
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

export default function PromptBuilder({
  onSubmit,
  isLoading = false,
  initialPrompt = '',
  onPromptChange,
  characters = [],
  initialCharacterIds = [],
}: PromptBuilderProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [contentType, setContentType] = useState<ContentType>('image');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [shotType, setShotType] = useState('');
  const [lighting, setLighting] = useState('');
  const [mood, setMood] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1024x1024');
  const [visualStyleId, setVisualStyleId] = useState<string | null>(null);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>(initialCharacterIds);
  const [error, setError] = useState('');
  const [creditsRemaining, setCreditsRemaining] = useState(100);

  // Load credits on mount and after loading state changes
  useEffect(() => {
    // Invalidate cache when loading finishes (after generation completes)
    if (!isLoading) {
      invalidateCreditsCache();
    }

    // Fetch credits asynchronously
    const loadCredits = async () => {
      const credits = await getCreditsRemaining();
      setCreditsRemaining(credits);
    };
    loadCredits();
  }, [isLoading]);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    onPromptChange?.(value);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError('Please enter a scene description');
      return;
    }

    // Check credits (video requires 10 credits, image requires 1)
    const requiredCredits = contentType === 'video' ? 10 : 1;
    if (creditsRemaining < requiredCredits) {
      setError(`Insufficient credits. ${contentType === 'video' ? 'Video generation requires 10 credits.' : 'Please upgrade your plan to continue generating.'}`);
      return;
    }

    // Build the final prompt with style modifier
    const styleModifier = getStyleModifier(visualStyleId);
    const finalPrompt = styleModifier
      ? `${trimmedPrompt}, ${styleModifier}`
      : trimmedPrompt;

    onSubmit({
      prompt: finalPrompt,
      contentType,
      shotType: shotType || undefined,
      style: visualStyleId || undefined,
      lighting: lighting || undefined,
      mood: mood || undefined,
      aspectRatio,
      visualStyleId: visualStyleId || undefined,
      characterIds: selectedCharacterIds.length > 0 ? selectedCharacterIds : undefined,
    });
  };

  const selectedStyleName = visualStyleId
    ? require('./VisualStyleSelector').VISUAL_STYLES.find((s: { id: string }) => s.id === visualStyleId)?.name
    : null;

  return (
    <div className={styles.builder}>
      <form onSubmit={handleSubmit}>
        {/* Content Type Selector */}
        <div className={styles.contentTypeSelector}>
          <label className={styles.label}>Content Type</label>
          <div className={styles.contentTypeButtons}>
            <button
              type="button"
              onClick={() => setContentType('image')}
              className={`${styles.contentTypeButton} ${contentType === 'image' ? styles.contentTypeActive : ''}`}
              disabled={isLoading}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>Image</span>
            </button>
            <button
              type="button"
              onClick={() => setContentType('video')}
              className={`${styles.contentTypeButton} ${contentType === 'video' ? styles.contentTypeActive : ''}`}
              disabled={isLoading}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <span>Video</span>
              <span className={styles.creditBadge}>10 credits</span>
            </button>
          </div>
        </div>

        <div className={styles.mainInput}>
          <label htmlFor="prompt" className={styles.label}>
            Scene Description
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={e => handlePromptChange(e.target.value)}
            placeholder="Describe your scene... e.g., 'A lone samurai standing on a misty mountain peak at dawn, cherry blossoms falling around him'"
            className={`input textarea ${styles.textarea}`}
            rows={4}
            disabled={isLoading}
          />
        </div>

        {/* Visual Style Quick Toggle */}
        <div className={styles.styleToggle}>
          <button
            type="button"
            onClick={() => setShowStyleSelector(!showStyleSelector)}
            className={`${styles.styleButton} ${visualStyleId ? styles.styleActive : ''}`}
          >
            <span className={styles.styleIcon}><PaletteIcon size={18} /></span>
            {visualStyleId ? (
              <span>Style: <strong>{selectedStyleName}</strong></span>
            ) : (
              <span>Choose Visual Style</span>
            )}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ transform: showStyleSelector ? 'rotate(180deg)' : 'none' }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        {showStyleSelector && (
          <div className={styles.styleSection}>
            <VisualStyleSelector
              selectedStyleId={visualStyleId}
              onSelectStyle={setVisualStyleId}
            />
          </div>
        )}

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

            {characters.length > 0 && (
              <CharacterSelector
                characters={characters}
                selectedIds={selectedCharacterIds}
                onSelectionChange={setSelectedCharacterIds}
              />
            )}
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.submitRow}>
          <div className={styles.creditsIndicator}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span className={creditsRemaining <= 10 ? styles.creditsLow : ''}>
              {creditsRemaining} credit{creditsRemaining !== 1 ? 's' : ''} remaining
            </span>
          </div>
          <button
            type="submit"
            className={`btn btn-primary ${styles.submitButton}`}
            disabled={isLoading || !prompt.trim() || creditsRemaining <= 0}
          >
            {isLoading ? (
              <>
                <span className="spinner" />
                Generating...
              </>
            ) : creditsRemaining <= 0 ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v2m0 4h.01M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                No Credits
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
        </div>
      </form>
    </div>
  );
}

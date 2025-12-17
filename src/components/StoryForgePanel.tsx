import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Project, StoryForgeFeatureId } from '@/types';
import { useToast } from '@/components/Toast';
import {
  AIAuthorSettings,
  GenreType,
  QualityTier,
  DEFAULT_AI_SETTINGS,
  GENRE_PRESETS,
  QUALITY_TIERS,
  TIER_CREDITS,
  getAvailableGenres,
  getGenreSettings,
} from '@/config/ai-settings';
import styles from './StoryForgePanel.module.css';

const MAX_CONTENT_LENGTH = 10000;

interface StoryForgePanelProps {
  project: Project;
  featureId: StoryForgeFeatureId | null;
  onClose: () => void;
}

interface FeatureConfig {
  id: StoryForgeFeatureId;
  title: string;
  description: string;
  placeholder: string;
  buttonText: string;
  icon: React.ReactNode;
}

const featureConfigs: Record<StoryForgeFeatureId, FeatureConfig> = {
  'narrative-generation': {
    id: 'narrative-generation',
    title: 'AI Narrative Generation',
    description: 'Generate compelling narratives, chapters, and scenes using advanced AI. Provide a prompt or outline to get started.',
    placeholder: 'Describe what you want to generate... e.g., "Write an opening chapter introducing the protagonist in a dystopian city"',
    buttonText: 'Generate Narrative',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
    ),
  },
  'chapter-expansion': {
    id: 'chapter-expansion',
    title: 'Chapter Expansion',
    description: 'Expand your chapter outlines into full, detailed chapters. Provide a chapter summary or outline to expand.',
    placeholder: 'Paste your chapter outline or summary here... e.g., "Chapter 3: The protagonist discovers the truth about their origins"',
    buttonText: 'Expand Chapter',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="12" y2="14" />
      </svg>
    ),
  },
  'scene-expansion': {
    id: 'scene-expansion',
    title: 'Scene Expansion',
    description: 'Transform scene summaries into vivid, detailed scenes with sensory details and character interactions.',
    placeholder: 'Describe the scene you want to expand... e.g., "A tense dinner scene where the family secret is revealed"',
    buttonText: 'Expand Scene',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  'rewrite-condense': {
    id: 'rewrite-condense',
    title: 'Rewrite & Condense',
    description: 'Rewrite passages for better flow or condense verbose sections. Paste your content and specify your goal.',
    placeholder: 'Paste the content you want to rewrite or condense...',
    buttonText: 'Process Content',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  'canon-validation': {
    id: 'canon-validation',
    title: 'Canon Validation',
    description: 'Ensure story consistency by validating new content against your established canon and world lore.',
    placeholder: 'Paste the content you want to validate against your project\'s canon...',
    buttonText: 'Validate Canon',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  'ai-author-controls': {
    id: 'ai-author-controls',
    title: 'AI Author Controls',
    description: 'Fine-tune AI behavior with author controls. Adjust tone, style, pacing, and creativity levels.',
    placeholder: '',
    buttonText: 'Save Settings',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
};

type RewriteMode = 'rewrite' | 'condense' | 'continue';

export default function StoryForgePanel({ project, featureId, onClose }: StoryForgePanelProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [inputContent, setInputContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>('rewrite');
  const [selectedGenre, setSelectedGenre] = useState<GenreType | null>(null);
  const [qualityTier, setQualityTier] = useState<QualityTier>('professional');
  const [authorSettings, setAuthorSettings] = useState<AIAuthorSettings>(DEFAULT_AI_SETTINGS);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [recommendationReasoning, setRecommendationReasoning] = useState<string | null>(null);

  // Apply genre preset
  const handleGenreSelect = (genre: GenreType | null) => {
    setSelectedGenre(genre);
    if (genre) {
      setAuthorSettings(getGenreSettings(genre));
      showToast(`Applied ${GENRE_PRESETS[genre].name} preset`, 'success');
    } else {
      setAuthorSettings(DEFAULT_AI_SETTINGS);
    }
    setRecommendationReasoning(null);
  };

  // AI-Assisted settings recommendation
  const handleAIAssisted = async () => {
    setIsLoadingRecommendations(true);
    setRecommendationReasoning(null);

    try {
      const response = await fetch('/api/storyforge/recommend-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get recommendations');
      }

      // Apply recommended settings
      setAuthorSettings(data.settings);
      setSelectedGenre(data.recommendedGenre);
      setQualityTier(data.recommendedTier);
      setRecommendationReasoning(data.reasoning);

      const confidenceLabel = data.confidence >= 0.8 ? 'high' : data.confidence >= 0.6 ? 'good' : 'moderate';
      showToast(
        `AI-optimized settings applied (${confidenceLabel} confidence)`,
        'success'
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to get AI recommendations',
        'error'
      );
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  if (!featureId) {
    return (
      <div className={styles.panel}>
        <div className={styles.noFeature}>
          <div className={styles.noFeatureIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
          </div>
          <h3>Select a Writer&apos;s Room Feature</h3>
          <p>Choose a feature from below to get started with AI-assisted writing.</p>
          <div className={styles.featureButtons}>
            {Object.values(featureConfigs).map((config) => (
              <button
                key={config.id}
                className={styles.featureButton}
                onClick={() => router.push(`/project/${project.id}?mode=storyforge&feature=${config.id}`)}
              >
                <span className={styles.featureButtonIcon}>{config.icon}</span>
                <span>{config.title}</span>
              </button>
            ))}
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            Return to Cinema Mode
          </button>
        </div>
      </div>
    );
  }

  const config = featureConfigs[featureId];

  if (!config) {
    return (
      <div className={styles.panel}>
        <div className={styles.error}>
          <p>Unknown feature: {featureId}</p>
          <button onClick={onClose}>Go Back</button>
        </div>
      </div>
    );
  }

  const handleProcess = async () => {
    if (!inputContent.trim() && featureId !== 'ai-author-controls') {
      showToast('Please enter some content to process', 'warning');
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      // Call the StoryForge API
      const response = await fetch('/api/storyforge/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          feature: featureId,
          content: inputContent,
          options: featureId === 'rewrite-condense' ? { mode: rewriteMode } : undefined,
          authorSettings,
          genre: selectedGenre,
          qualityTier,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process content');
      }

      if (featureId === 'ai-author-controls') {
        showToast('Author settings saved successfully', 'success');
      } else {
        setResult(data.result);
        showToast('Content processed successfully', 'success');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'An error occurred', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyResult = async () => {
    if (!result) return;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(result);
        showToast('Copied to clipboard', 'success');
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = result;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) {
          showToast('Copied to clipboard', 'success');
        } else {
          showToast('Failed to copy to clipboard', 'error');
        }
      }
    } catch {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleSwitchFeature = (newFeatureId: StoryForgeFeatureId) => {
    setInputContent('');
    setResult(null);
    router.push(`/project/${project.id}?mode=storyforge&feature=${newFeatureId}`);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.headerIcon}>{config.icon}</div>
          <div>
            <h2 className={styles.title}>{config.title}</h2>
            <p className={styles.description}>{config.description}</p>
          </div>
        </div>
        <button className={styles.closeIcon} onClick={onClose} title="Return to Cinema Mode">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Feature Tabs */}
      <div className={styles.featureTabs}>
        {Object.values(featureConfigs).map((cfg) => (
          <button
            key={cfg.id}
            className={`${styles.featureTab} ${cfg.id === featureId ? styles.active : ''}`}
            onClick={() => handleSwitchFeature(cfg.id)}
          >
            <span className={styles.tabIcon}>{cfg.icon}</span>
            <span className={styles.tabLabel}>{cfg.title}</span>
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {featureId === 'ai-author-controls' ? (
          <div className={styles.authorControls}>
            {/* Genre Presets Section */}
            <div className={styles.presetsSection}>
              <h4 className={styles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
                Genre Presets
              </h4>
              <p className={styles.sectionDesc}>Select a genre for optimized AI settings based on best-selling works</p>
              <div className={styles.genreGrid}>
                <button
                  className={`${styles.genreButton} ${selectedGenre === null ? styles.active : ''}`}
                  onClick={() => handleGenreSelect(null)}
                >
                  <span className={styles.genreName}>Custom</span>
                  <span className={styles.genreDesc}>Manual settings</span>
                </button>
                {getAvailableGenres().map((preset) => (
                  <button
                    key={preset.id}
                    className={`${styles.genreButton} ${selectedGenre === preset.id ? styles.active : ''}`}
                    onClick={() => handleGenreSelect(preset.id)}
                    title={preset.description}
                  >
                    <span className={styles.genreName}>{preset.name}</span>
                    <span className={styles.genreDesc}>{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Tier Section */}
            <div className={styles.qualitySection}>
              <h4 className={styles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Quality Tier
              </h4>
              <div className={styles.qualityTiers}>
                {(Object.keys(QUALITY_TIERS) as QualityTier[]).map((tier) => {
                  const credits = TIER_CREDITS[tier];
                  return (
                    <button
                      key={tier}
                      className={`${styles.tierButton} ${qualityTier === tier ? styles.active : ''}`}
                      onClick={() => setQualityTier(tier)}
                    >
                      <span className={styles.tierName}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
                      <span className={styles.tierTokens}>{QUALITY_TIERS[tier].maxTokens} tokens</span>
                      <span className={styles.tierCredits}>{credits} credit{credits > 1 ? 's' : ''}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Settings */}
            <div className={styles.settingsSection}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                  Fine-Tune Settings
                </h4>
                <button
                  className={styles.aiAssistedButton}
                  onClick={handleAIAssisted}
                  disabled={isLoadingRecommendations}
                  title="Get AI-optimized settings based on your project and best-seller data"
                >
                  {isLoadingRecommendations ? (
                    <>
                      <span className={styles.spinner} />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                      AI-Assisted
                    </>
                  )}
                </button>
              </div>

              <div className={styles.settingsGrid}>
                <div className={styles.controlGroup}>
                  <label htmlFor="tone">Tone</label>
                  <select
                    id="tone"
                    value={authorSettings.tone}
                    onChange={(e) => setAuthorSettings({ ...authorSettings, tone: e.target.value as AIAuthorSettings['tone'] })}
                  >
                    <option value="neutral">Neutral</option>
                    <option value="formal">Formal</option>
                    <option value="casual">Casual</option>
                    <option value="dramatic">Dramatic</option>
                    <option value="humorous">Humorous</option>
                    <option value="dark">Dark</option>
                    <option value="whimsical">Whimsical</option>
                    <option value="suspenseful">Suspenseful</option>
                    <option value="romantic">Romantic</option>
                    <option value="epic">Epic</option>
                  </select>
                </div>

                <div className={styles.controlGroup}>
                  <label htmlFor="style">Writing Style</label>
                  <select
                    id="style"
                    value={authorSettings.style}
                    onChange={(e) => setAuthorSettings({ ...authorSettings, style: e.target.value as AIAuthorSettings['style'] })}
                  >
                    <option value="descriptive">Descriptive</option>
                    <option value="minimalist">Minimalist</option>
                    <option value="poetic">Poetic</option>
                    <option value="action-oriented">Action-Oriented</option>
                    <option value="dialogue-heavy">Dialogue-Heavy</option>
                    <option value="literary">Literary</option>
                    <option value="cinematic">Cinematic</option>
                    <option value="journalistic">Journalistic</option>
                    <option value="stream-of-consciousness">Stream of Consciousness</option>
                  </select>
                </div>

                <div className={styles.controlGroup}>
                  <label htmlFor="pacing">Pacing</label>
                  <select
                    id="pacing"
                    value={authorSettings.pacing}
                    onChange={(e) => setAuthorSettings({ ...authorSettings, pacing: e.target.value as AIAuthorSettings['pacing'] })}
                  >
                    <option value="slow">Slow & Deliberate</option>
                    <option value="medium">Medium</option>
                    <option value="fast">Fast-Paced</option>
                    <option value="varied">Varied</option>
                    <option value="building">Building (Crescendo)</option>
                  </select>
                </div>

                <div className={styles.controlGroup}>
                  <label htmlFor="verbosity">Detail Level</label>
                  <select
                    id="verbosity"
                    value={authorSettings.verbosity}
                    onChange={(e) => setAuthorSettings({ ...authorSettings, verbosity: e.target.value as AIAuthorSettings['verbosity'] })}
                  >
                    <option value="concise">Concise</option>
                    <option value="balanced">Balanced</option>
                    <option value="detailed">Detailed</option>
                    <option value="elaborate">Elaborate</option>
                  </select>
                </div>

                <div className={styles.controlGroup}>
                  <label htmlFor="perspective">Perspective</label>
                  <select
                    id="perspective"
                    value={authorSettings.perspective}
                    onChange={(e) => setAuthorSettings({ ...authorSettings, perspective: e.target.value as AIAuthorSettings['perspective'] })}
                  >
                    <option value="first-person">First Person</option>
                    <option value="third-person-limited">Third Person Limited</option>
                    <option value="third-person-omniscient">Third Person Omniscient</option>
                    <option value="second-person">Second Person</option>
                  </select>
                </div>

                <div className={styles.controlGroup}>
                  <label htmlFor="dialogueStyle">Dialogue Style</label>
                  <select
                    id="dialogueStyle"
                    value={authorSettings.dialogueStyle}
                    onChange={(e) => setAuthorSettings({ ...authorSettings, dialogueStyle: e.target.value as AIAuthorSettings['dialogueStyle'] })}
                  >
                    <option value="natural">Natural</option>
                    <option value="stylized">Stylized</option>
                    <option value="minimal">Minimal</option>
                    <option value="subtext-heavy">Subtext-Heavy</option>
                    <option value="witty">Witty</option>
                  </select>
                </div>
              </div>

              <div className={styles.controlGroup}>
                <label htmlFor="creativity">
                  Creativity Level: {Math.round(authorSettings.creativity * 100)}%
                </label>
                <input
                  type="range"
                  id="creativity"
                  min="0"
                  max="1"
                  step="0.05"
                  value={authorSettings.creativity}
                  onChange={(e) => setAuthorSettings({ ...authorSettings, creativity: parseFloat(e.target.value) })}
                  className={styles.slider}
                />
                <div className={styles.sliderLabels}>
                  <span>Conservative</span>
                  <span>Balanced</span>
                  <span>Creative</span>
                </div>
              </div>
            </div>

            {/* AI Recommendation Reasoning */}
            {recommendationReasoning && (
              <div className={styles.aiRecommendation}>
                <div className={styles.aiRecommendationHeader}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                  <span>AI-Optimized for Your Project</span>
                </div>
                <p>{recommendationReasoning}</p>
                <p className={styles.aiRecommendationNote}>
                  Settings calibrated using best-seller performance data as of {new Date(project.updatedAt).toLocaleDateString()}.
                </p>
              </div>
            )}

            {/* Current Settings Summary */}
            {selectedGenre && !recommendationReasoning && (
              <div className={styles.settingsSummary}>
                <h4>Active Preset: {GENRE_PRESETS[selectedGenre].name}</h4>
                <p>{GENRE_PRESETS[selectedGenre].description}</p>
                <p className={styles.summaryNote}>
                  These settings are optimized based on analysis of best-selling {GENRE_PRESETS[selectedGenre].name.toLowerCase()} works.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {featureId === 'rewrite-condense' && (
              <div className={styles.modeSelector}>
                <button
                  className={`${styles.modeButton} ${rewriteMode === 'rewrite' ? styles.active : ''}`}
                  onClick={() => setRewriteMode('rewrite')}
                >
                  Rewrite
                </button>
                <button
                  className={`${styles.modeButton} ${rewriteMode === 'condense' ? styles.active : ''}`}
                  onClick={() => setRewriteMode('condense')}
                >
                  Condense
                </button>
                <button
                  className={`${styles.modeButton} ${rewriteMode === 'continue' ? styles.active : ''}`}
                  onClick={() => setRewriteMode('continue')}
                >
                  Continue
                </button>
              </div>
            )}

            <textarea
              id="storyforge-input"
              aria-label={`Input content for ${config.title}`}
              className={styles.textarea}
              placeholder={config.placeholder}
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              maxLength={MAX_CONTENT_LENGTH}
              rows={8}
            />
            {inputContent.length >= MAX_CONTENT_LENGTH * 0.8 && (
              <div className={styles.charCount}>
                {inputContent.length.toLocaleString()} / {MAX_CONTENT_LENGTH.toLocaleString()} characters
              </div>
            )}
          </>
        )}

        <div className={styles.actions}>
          <button
            className={`btn btn-primary ${styles.processButton}`}
            onClick={handleProcess}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <span className={styles.spinner} />
                Processing...
              </>
            ) : (
              config.buttonText
            )}
          </button>
        </div>

        {result && (
          <div className={styles.resultSection}>
            <div className={styles.resultHeader}>
              <h3>Result</h3>
              <button className={styles.copyButton} onClick={handleCopyResult}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Copy
              </button>
            </div>
            <div className={styles.resultContent}>
              {result}
            </div>
          </div>
        )}

        {/* Project Context */}
        <div className={styles.contextSection}>
          <h4>Project Context</h4>
          <div className={styles.contextInfo}>
            <span>Project: {project.name}</span>
            {project.lore && project.lore.length > 0 && (
              <span>{project.lore.length} lore entries available</span>
            )}
            {project.characters && project.characters.length > 0 && (
              <span>{project.characters.length} characters defined</span>
            )}
          </div>
          <p className={styles.contextNote}>
            Writer&apos;s Room uses your project&apos;s world lore and characters to maintain consistency.
          </p>
        </div>
      </div>

      <div className={styles.footer}>
        <Link href="/storyforge" className={styles.backLink}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Writer&apos;s Room
        </Link>
        <span className={styles.tierBadge}>Pro Feature</span>
      </div>
    </div>
  );
}

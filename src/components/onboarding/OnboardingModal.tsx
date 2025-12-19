/**
 * Immersive Onboarding Modal
 *
 * A multi-step guided experience that showcases Halcyon Cinema's capabilities
 * and drives conversion for free-tier users.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useOnboarding } from './OnboardingContext';
import styles from './Onboarding.module.css';

// Icons
const SparkleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
  </svg>
);

const PenIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
  </svg>
);

const FilmIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
    <line x1="7" y1="2" x2="7" y2="22" />
    <line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="7" x2="7" y2="7" />
    <line x1="2" y1="17" x2="7" y2="17" />
    <line x1="17" y1="7" x2="22" y2="7" />
    <line x1="17" y1="17" x2="22" y2="17" />
  </svg>
);

const RocketIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
    <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const CrownIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
  </svg>
);

// ============================================================================
// Step Components
// ============================================================================

interface StepProps {
  onNext: () => void;
  onSkip?: () => void;
  onBack?: () => void;
}

interface WelcomeStepProps extends StepProps {
  onSelectPath: (path: 'writers-room' | 'cinema' | 'instant-export') => void;
}

function WelcomeStep({ onNext, onSkip, onSelectPath }: WelcomeStepProps) {
  const handlePathSelect = (path: 'writers-room' | 'cinema' | 'instant-export') => {
    onSelectPath(path);
    onNext();
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepIcon}>
        <SparkleIcon />
      </div>
      <h2 className={styles.stepTitle}>Welcome to Your Creative Studio</h2>
      <p className={styles.stepDescription}>
        Transform your ideas into stunning visual stories. Choose your path below
        to experience the power of AI-assisted storytelling.
      </p>

      <div className={styles.featurePreview}>
        <button
          type="button"
          className={styles.previewCardClickable}
          onClick={() => handlePathSelect('writers-room')}
        >
          <div className={styles.previewIcon}><PenIcon /></div>
          <h4>Writer&apos;s Room</h4>
          <p>AI-powered writing that understands your story</p>
        </button>
        <button
          type="button"
          className={styles.previewCardClickable}
          onClick={() => handlePathSelect('cinema')}
        >
          <div className={styles.previewIcon}><FilmIcon /></div>
          <h4>Cinema Mode</h4>
          <p>Visualize scenes with cinematic precision</p>
        </button>
        <button
          type="button"
          className={styles.previewCardClickable}
          onClick={() => handlePathSelect('instant-export')}
        >
          <div className={styles.previewIcon}><RocketIcon /></div>
          <h4>Instant Export</h4>
          <p>Quick start - create and export right away</p>
        </button>
      </div>

      <div className={styles.stepActions}>
        <button className={styles.textButton} onClick={onSkip}>
          Skip Tour
        </button>
      </div>
    </div>
  );
}

function CreateProjectStep({ onNext, onBack }: StepProps) {
  const router = useRouter();
  const { markProjectCreated } = useOnboarding();
  const [projectName, setProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: projectName,
          description: 'My first project created during onboarding',
        }),
      });

      if (response.ok) {
        const project = await response.json();
        markProjectCreated();
        // Navigate to the project with onboarding mode
        router.push(`/project/${project.id}?onboarding=true`);
        onNext();
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Failed to create project. Please try again.');
      }
    } catch (err) {
      console.error('Failed to create project:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepIcon}>
        <PenIcon />
      </div>
      <h2 className={styles.stepTitle}>Create Your First Story</h2>
      <p className={styles.stepDescription}>
        Every great story starts with a single idea. Give your project a name
        and we&apos;ll help you bring it to life.
      </p>

      <div className={styles.inputGroup}>
        <label htmlFor="project-name">Project Name</label>
        <input
          id="project-name"
          type="text"
          placeholder="e.g., The Last Sunrise, My Sci-Fi Epic..."
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className={styles.textInput}
          autoFocus
        />
        <span className={styles.inputHint}>
          Don&apos;t worry, you can always change this later
        </span>
      </div>

      <div className={styles.suggestionChips}>
        <span className={styles.chipLabel}>Quick start:</span>
        <button
          className={styles.chip}
          onClick={() => setProjectName('Echoes of Tomorrow')}
        >
          Sci-Fi Drama
        </button>
        <button
          className={styles.chip}
          onClick={() => setProjectName('The Crimson Crown')}
        >
          Fantasy Epic
        </button>
        <button
          className={styles.chip}
          onClick={() => setProjectName('City of Shadows')}
        >
          Noir Thriller
        </button>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      <div className={styles.stepActions}>
        <button className={styles.secondaryButton} onClick={onBack}>
          Back
        </button>
        <button
          className={styles.primaryButton}
          onClick={handleCreateProject}
          disabled={!projectName.trim() || isCreating}
        >
          {isCreating ? 'Creating...' : 'Create Project'} <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}

function ExploreWritersRoomStep({ onNext, onBack }: StepProps) {
  const { markWritersRoomTried, progress } = useOnboarding();

  const handleExplore = () => {
    markWritersRoomTried();
    onNext();
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepIconPro}>
        <PenIcon />
        <span className={styles.proLabel}>PRO</span>
      </div>
      <h2 className={styles.stepTitle}>Discover Writer&apos;s Room</h2>
      <p className={styles.stepDescription}>
        Writer&apos;s Room is your AI co-author. It understands narrative structure,
        character development, and can generate entire chapters that match your style.
      </p>

      <div className={styles.featureList}>
        <div className={styles.featureItem}>
          <CheckIcon />
          <span><strong>AI Narrative Generation</strong> - Create chapters, scenes, and dialogue</span>
        </div>
        <div className={styles.featureItem}>
          <CheckIcon />
          <span><strong>Smart Expansion</strong> - Turn outlines into full prose</span>
        </div>
        <div className={styles.featureItem}>
          <CheckIcon />
          <span><strong>Canon Validation</strong> - Keep your story consistent</span>
        </div>
        <div className={styles.featureItem}>
          <CheckIcon />
          <span><strong>Style Controls</strong> - Fine-tune tone, pacing, and voice</span>
        </div>
      </div>

      <div className={styles.trialBadge}>
        <SparkleIcon />
        <span>You have <strong>{progress.trialCreditsRemaining} free generations</strong> to try!</span>
      </div>

      <div className={styles.stepActions}>
        <button className={styles.secondaryButton} onClick={onBack}>
          Back
        </button>
        <button className={styles.primaryButton} onClick={handleExplore}>
          Try It Now <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}

function TryAIGenerationStep({ onNext, onBack }: StepProps) {
  const { markContentGenerated, consumeTrialCredit, progress } = useOnboarding();
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const samplePrompts = [
    'A mysterious stranger arrives at a small coastal town at midnight',
    'Two rivals meet for the first time since their fateful duel',
    'A scientist discovers something impossible in her laboratory',
  ];

  const handleGenerate = async () => {
    if (!prompt.trim() || progress.trialCreditsRemaining <= 0) return;

    setIsGenerating(true);
    try {
      // Consume trial credit
      const creditUsed = consumeTrialCredit();
      if (!creditUsed) {
        return;
      }

      // Call the generation API
      const response = await fetch('/api/writers-room/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'onboarding-demo',
          feature: 'scene-expansion',
          content: prompt,
          authorSettings: {
            tone: 'dramatic',
            style: 'cinematic',
            pacing: 'medium',
            creativity: 0.8,
            verbosity: 'balanced',
            perspective: 'third-person-limited',
            dialogueStyle: 'natural',
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedContent(data.result || 'Generated content would appear here...');
        markContentGenerated();
      } else {
        // Demo fallback if API fails
        setGeneratedContent(
          `The night was thick with anticipation as ${prompt.toLowerCase()}.\n\n` +
          `Shadows danced across weathered cobblestones, cast by the flickering gas lamps that lined the narrow street. ` +
          `The air carried the scent of salt and distant rain, a reminder that the sea was never far from this place.\n\n` +
          `In moments like these, when the world held its breath between heartbeats, anything seemed possible. ` +
          `The kind of possibility that could reshape destinies—or end them entirely.`
        );
        markContentGenerated();
      }
    } catch (error) {
      console.error('Generation failed:', error);
      // Provide demo content on error
      setGeneratedContent(
        `The scene unfolds with cinematic precision...\n\n` +
        `Your prompt "${prompt}" sparks a vivid narrative. With Writer's Room Pro, ` +
        `you'll get full AI-generated scenes, chapters, and dialogue tailored to your story's unique voice.`
      );
      markContentGenerated();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepIcon}>
        <SparkleIcon />
      </div>
      <h2 className={styles.stepTitle}>Experience AI Writing</h2>
      <p className={styles.stepDescription}>
        Describe a scene and watch as AI brings it to life with rich,
        publication-quality prose.
      </p>

      <div className={styles.inputGroup}>
        <label htmlFor="scene-prompt">Describe your scene</label>
        <textarea
          id="scene-prompt"
          placeholder="e.g., A detective discovers a hidden message in an old photograph..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={styles.textArea}
          rows={3}
        />
      </div>

      <div className={styles.suggestionChips}>
        <span className={styles.chipLabel}>Try one:</span>
        {samplePrompts.map((p, i) => (
          <button
            key={i}
            className={styles.chip}
            onClick={() => setPrompt(p)}
          >
            {p.substring(0, 30)}...
          </button>
        ))}
      </div>

      {generatedContent && (
        <div className={styles.generatedOutput}>
          <h4>Generated Scene</h4>
          <div className={styles.outputText}>{generatedContent}</div>
        </div>
      )}

      <div className={styles.creditsRemaining}>
        <SparkleIcon />
        <span>{progress.trialCreditsRemaining} trial generation{progress.trialCreditsRemaining !== 1 ? 's' : ''} remaining</span>
      </div>

      <div className={styles.stepActions}>
        <button className={styles.secondaryButton} onClick={onBack}>
          Back
        </button>
        {generatedContent ? (
          <button className={styles.primaryButton} onClick={onNext}>
            Continue <ArrowRightIcon />
          </button>
        ) : (
          <button
            className={styles.primaryButton}
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating || progress.trialCreditsRemaining <= 0}
          >
            {isGenerating ? 'Generating...' : 'Generate Scene'} <SparkleIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function PreviewCinemaStep({ onNext, onBack }: StepProps) {
  const { markCinemaPreviewed } = useOnboarding();

  const handlePreview = () => {
    markCinemaPreviewed();
    onNext();
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepIcon}>
        <FilmIcon />
      </div>
      <h2 className={styles.stepTitle}>Visualize Your Story</h2>
      <p className={styles.stepDescription}>
        Cinema Mode transforms your written scenes into stunning visual storyboards.
        See your story come alive before you write a single screenplay page.
      </p>

      <div className={styles.cinemaPreview}>
        <div className={styles.previewFrame}>
          <div className={styles.previewPlaceholder}>
            <FilmIcon />
            <span>Scene visualization preview</span>
          </div>
        </div>
        <div className={styles.previewDetails}>
          <div className={styles.detailItem}>
            <strong>Shot Type:</strong> Wide establishing shot
          </div>
          <div className={styles.detailItem}>
            <strong>Mood:</strong> Mysterious, tension
          </div>
          <div className={styles.detailItem}>
            <strong>Lighting:</strong> Low-key, dramatic shadows
          </div>
        </div>
      </div>

      <div className={styles.featureList}>
        <div className={styles.featureItem}>
          <CheckIcon />
          <span><strong>Scene-to-Shot Translation</strong> - Automatic visual composition</span>
        </div>
        <div className={styles.featureItem}>
          <CheckIcon />
          <span><strong>Cinematic Prompts</strong> - Professional shot descriptions</span>
        </div>
        <div className={styles.featureItem}>
          <CheckIcon />
          <span><strong>Style Presets</strong> - From noir to sci-fi aesthetics</span>
        </div>
      </div>

      <div className={styles.stepActions}>
        <button className={styles.secondaryButton} onClick={onBack}>
          Back
        </button>
        <button className={styles.primaryButton} onClick={handlePreview}>
          See Results <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}

function TryCinemaGenerationStep({ onNext, onBack }: StepProps) {
  const { markCinemaPreviewed, consumeTrialCredit, progress } = useOnboarding();
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);

  const samplePrompts = [
    'A mysterious figure silhouetted against a neon-lit cityscape at night',
    'An ancient temple hidden deep in a misty jungle at dawn',
    'A futuristic spacecraft approaching a massive space station',
  ];

  const handleGenerate = async () => {
    if (!prompt.trim() || progress.trialCreditsRemaining <= 0) return;

    setIsGenerating(true);
    setGenerationError(null);
    setHasAttempted(true);
    try {
      const creditUsed = consumeTrialCredit();
      if (!creditUsed) {
        setIsGenerating(false);
        return;
      }

      const response = await fetch('/api/demo/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          genre: 'cinematic',
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.imageUrl) {
        setGeneratedImage(data.imageUrl);
        markCinemaPreviewed();
      } else {
        // Show error but allow continuing
        setGenerationError(data.error || 'Image generation is temporarily unavailable. You can still continue to explore the platform.');
        markCinemaPreviewed();
      }
    } catch (error) {
      console.error('Image generation failed:', error);
      setGenerationError('Image generation is temporarily unavailable. You can still continue to explore the platform.');
      markCinemaPreviewed();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepIcon}>
        <FilmIcon />
      </div>
      <h2 className={styles.stepTitle}>Generate Your First Scene</h2>
      <p className={styles.stepDescription}>
        Describe a cinematic scene and watch AI bring it to life with stunning visuals.
      </p>

      <div className={styles.inputGroup}>
        <label htmlFor="cinema-prompt">Describe your scene</label>
        <textarea
          id="cinema-prompt"
          placeholder="e.g., A lone detective standing in a rain-soaked alley, neon signs reflecting on wet pavement..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={styles.textArea}
          rows={3}
        />
      </div>

      <div className={styles.suggestionChips}>
        <span className={styles.chipLabel}>Try one:</span>
        {samplePrompts.map((p, i) => (
          <button
            key={i}
            className={styles.chip}
            onClick={() => setPrompt(p)}
          >
            {p.substring(0, 30)}...
          </button>
        ))}
      </div>

      {generatedImage && (
        <div className={styles.generatedImageOutput}>
          <h4>Generated Scene</h4>
          <div className={styles.imageFrame}>
            <img src={generatedImage} alt="Generated scene" />
          </div>
        </div>
      )}

      {generationError && (
        <div className={styles.errorMessage}>
          {generationError}
        </div>
      )}

      <div className={styles.creditsRemaining}>
        <SparkleIcon />
        <span>{progress.trialCreditsRemaining} trial generation{progress.trialCreditsRemaining !== 1 ? 's' : ''} remaining</span>
      </div>

      <div className={styles.stepActions}>
        <button className={styles.secondaryButton} onClick={onBack}>
          Back
        </button>
        {generatedImage || (hasAttempted && generationError) ? (
          <button className={styles.primaryButton} onClick={onNext}>
            Continue <ArrowRightIcon />
          </button>
        ) : (
          <button
            className={styles.primaryButton}
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating || progress.trialCreditsRemaining <= 0}
          >
            {isGenerating ? 'Generating...' : 'Generate Scene'} <SparkleIcon />
          </button>
        )}
      </div>
    </div>
  );
}

interface SeeResultsStepProps extends StepProps {
  selectedPath: 'writers-room' | 'cinema' | 'instant-export' | null;
}

function SeeResultsStep({ onNext, onBack, selectedPath }: SeeResultsStepProps) {
  // Show path-specific achievements
  const getAchievements = () => {
    switch (selectedPath) {
      case 'writers-room':
        return [
          { text: 'Created your first project' },
          { text: 'Explored Writer\'s Room AI' },
          { text: 'Generated AI-powered content' },
        ];
      case 'cinema':
        return [
          { text: 'Created your first project' },
          { text: 'Discovered Cinema Mode' },
          { text: 'Generated a visual scene' },
        ];
      case 'instant-export':
        return [
          { text: 'Created your first project' },
          { text: 'Ready to start creating' },
        ];
      default:
        return [
          { text: 'Created your first project' },
          { text: 'Explored the platform' },
        ];
    }
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepIconSuccess}>
        <CheckIcon />
      </div>
      <h2 className={styles.stepTitle}>You&apos;re Ready to Create</h2>
      <p className={styles.stepDescription}>
        You&apos;ve experienced just a taste of what&apos;s possible. Imagine having
        unlimited access to these tools as you craft your masterpiece.
      </p>

      <div className={styles.achievementList}>
        {getAchievements().map((achievement, index) => (
          <div key={index} className={styles.achievement}>
            <CheckIcon />
            <span>{achievement.text}</span>
          </div>
        ))}
      </div>

      <div className={styles.comparisonTeaser}>
        <h4>With Pro, you get:</h4>
        <ul>
          <li>Unlimited AI generations</li>
          <li>Full Writer&apos;s Room access</li>
          <li>Advanced Cinema features</li>
          <li>Priority support</li>
        </ul>
      </div>

      <div className={styles.stepActions}>
        <button className={styles.secondaryButton} onClick={onBack}>
          Back
        </button>
        <button className={styles.primaryButton} onClick={onNext}>
          Continue <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}

function UpgradePromptStep({ onNext }: StepProps) {
  const router = useRouter();
  const { completeOnboarding } = useOnboarding();

  const handleUpgrade = () => {
    router.push('/pricing');
  };

  const handleContinueFree = () => {
    completeOnboarding();
    onNext();
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepIconPremium}>
        <CrownIcon />
      </div>
      <h2 className={styles.stepTitle}>Unlock Your Full Potential</h2>
      <p className={styles.stepDescription}>
        You&apos;ve seen what&apos;s possible. Now imagine creating without limits.
      </p>

      <div className={styles.pricingCard}>
        <div className={styles.pricingHeader}>
          <h3>Pro Plan</h3>
          <div className={styles.price}>
            <span className={styles.amount}>$19</span>
            <span className={styles.period}>/month</span>
          </div>
        </div>
        <div className={styles.pricingFeatures}>
          <div className={styles.pricingFeature}>
            <CheckIcon /> <span>Unlimited AI generations</span>
          </div>
          <div className={styles.pricingFeature}>
            <CheckIcon /> <span>Full Writer&apos;s Room access</span>
          </div>
          <div className={styles.pricingFeature}>
            <CheckIcon /> <span>Advanced Cinema features</span>
          </div>
          <div className={styles.pricingFeature}>
            <CheckIcon /> <span>500 monthly credits</span>
          </div>
          <div className={styles.pricingFeature}>
            <CheckIcon /> <span>All export formats</span>
          </div>
          <div className={styles.pricingFeature}>
            <CheckIcon /> <span>Priority support</span>
          </div>
        </div>
        <button className={styles.upgradeButton} onClick={handleUpgrade}>
          <CrownIcon /> Upgrade to Pro
        </button>
      </div>

      <div className={styles.guarantee}>
        <span>7-day money-back guarantee • Cancel anytime</span>
      </div>

      <button className={styles.textButton} onClick={handleContinueFree}>
        Continue with Free Plan
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function OnboardingModal() {
  const {
    progress,
    showOnboarding,
    selectPath,
    nextStep,
    prevStep,
    dismissOnboarding,
    completeOnboarding,
    currentStepIndex,
    totalSteps,
  } = useOnboarding();

  if (!showOnboarding) {
    return null;
  }

  const handleSkip = () => {
    dismissOnboarding();
  };

  const renderStep = () => {
    switch (progress.currentStep) {
      case 'welcome':
        return <WelcomeStep onNext={nextStep} onSkip={handleSkip} onSelectPath={selectPath} />;
      case 'create-project':
        return <CreateProjectStep onNext={nextStep} onBack={prevStep} />;
      case 'explore-writers-room':
        return <ExploreWritersRoomStep onNext={nextStep} onBack={prevStep} />;
      case 'try-ai-generation':
        return <TryAIGenerationStep onNext={nextStep} onBack={prevStep} />;
      case 'preview-cinema':
        return <PreviewCinemaStep onNext={nextStep} onBack={prevStep} />;
      case 'try-cinema-generation':
        return <TryCinemaGenerationStep onNext={nextStep} onBack={prevStep} />;
      case 'see-results':
        return <SeeResultsStep onNext={nextStep} onBack={prevStep} selectedPath={progress.selectedPath} />;
      case 'upgrade-prompt':
        return <UpgradePromptStep onNext={completeOnboarding} />;
      case 'completed':
        return null;
      default:
        return <WelcomeStep onNext={nextStep} onSkip={handleSkip} onSelectPath={selectPath} />;
    }
  };

  if (progress.currentStep === 'completed') {
    return null;
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        {/* Progress indicator */}
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Close button */}
        <button className={styles.closeButton} onClick={handleSkip} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Step content */}
        {renderStep()}

        {/* Step indicator - show dots based on total steps */}
        <div className={styles.stepIndicator}>
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div
              key={index}
              className={`${styles.stepDot} ${
                index < currentStepIndex
                  ? styles.completed
                  : index === currentStepIndex
                  ? styles.active
                  : ''
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default OnboardingModal;

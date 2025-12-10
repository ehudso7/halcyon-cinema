'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './GenerationProgress.module.css';

export type GenerationStage =
  | 'preparing'
  | 'analyzing'
  | 'composing'
  | 'rendering'
  | 'enhancing'
  | 'finalizing'
  | 'complete'
  | 'error';

interface GenerationProgressProps {
  isGenerating: boolean;
  onComplete?: () => void;
  error?: string | null;
  prompt?: string;
}

const STAGE_INFO: Record<GenerationStage, { label: string; description: string; duration: number }> = {
  preparing: {
    label: 'Preparing',
    description: 'Initializing AI generation pipeline...',
    duration: 800,
  },
  analyzing: {
    label: 'Analyzing Prompt',
    description: 'Understanding scene composition and elements...',
    duration: 1500,
  },
  composing: {
    label: 'Composing Scene',
    description: 'Arranging visual elements and composition...',
    duration: 2500,
  },
  rendering: {
    label: 'Rendering',
    description: 'DALL-E 3 is creating your cinematic vision...',
    duration: 8000,
  },
  enhancing: {
    label: 'Enhancing Details',
    description: 'Adding cinematic quality and fine details...',
    duration: 2000,
  },
  finalizing: {
    label: 'Finalizing',
    description: 'Preparing high-resolution output...',
    duration: 1200,
  },
  complete: {
    label: 'Complete',
    description: 'Your scene is ready!',
    duration: 0,
  },
  error: {
    label: 'Error',
    description: 'Something went wrong during generation',
    duration: 0,
  },
};

const STAGES_ORDER: GenerationStage[] = [
  'preparing',
  'analyzing',
  'composing',
  'rendering',
  'enhancing',
  'finalizing',
];

// Creative loading messages that rotate
const CREATIVE_MESSAGES = [
  "Conjuring pixels from the ether...",
  "Teaching AI about cinematography...",
  "Mixing light and shadow...",
  "Calibrating the dream machine...",
  "Translating imagination to image...",
  "Summoning visual magic...",
  "Painting with neural networks...",
  "Crafting your cinematic moment...",
];

export default function GenerationProgress({
  isGenerating,
  onComplete,
  error,
  prompt,
}: GenerationProgressProps) {
  const [currentStage, setCurrentStage] = useState<GenerationStage>('preparing');
  const [progress, setProgress] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [creativeMessage, setCreativeMessage] = useState(CREATIVE_MESSAGES[0]);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Rotate creative messages
  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setCreativeMessage(prev => {
        const currentIndex = CREATIVE_MESSAGES.indexOf(prev);
        return CREATIVE_MESSAGES[(currentIndex + 1) % CREATIVE_MESSAGES.length];
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  // Track elapsed time
  useEffect(() => {
    if (!isGenerating) {
      setElapsedTime(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  // Progress through stages
  useEffect(() => {
    if (!isGenerating) {
      setCurrentStage('preparing');
      setProgress(0);
      setStageProgress(0);
      return;
    }

    if (error) {
      setCurrentStage('error');
      return;
    }

    let stageIndex = 0;
    let totalProgress = 0;
    const progressPerStage = 100 / STAGES_ORDER.length;

    const advanceStage = () => {
      if (stageIndex < STAGES_ORDER.length) {
        const stage = STAGES_ORDER[stageIndex];
        setCurrentStage(stage);
        setStageProgress(0);

        // Animate stage progress
        const stageDuration = STAGE_INFO[stage].duration;
        const stageStartTime = Date.now();

        const stageInterval = setInterval(() => {
          const elapsed = Date.now() - stageStartTime;
          const stagePercent = Math.min((elapsed / stageDuration) * 100, 100);
          setStageProgress(stagePercent);

          const overallPercent = totalProgress + (stagePercent / 100) * progressPerStage;
          setProgress(Math.min(overallPercent, 95)); // Never show 100% until complete

          if (elapsed >= stageDuration) {
            clearInterval(stageInterval);
            totalProgress += progressPerStage;
            stageIndex++;

            if (stageIndex < STAGES_ORDER.length) {
              advanceStage();
            }
          }
        }, 50);

        return () => clearInterval(stageInterval);
      }
    };

    const cleanup = advanceStage();
    return cleanup;
  }, [isGenerating, error]);

  // Handle completion
  const handleComplete = useCallback(() => {
    setCurrentStage('complete');
    setProgress(100);
    setStageProgress(100);
    onComplete?.();
  }, [onComplete]);

  // When generation stops without error, mark as complete
  useEffect(() => {
    if (!isGenerating && !error && progress > 0) {
      handleComplete();
    }
  }, [isGenerating, error, progress, handleComplete]);

  if (!isGenerating && currentStage !== 'complete' && currentStage !== 'error') {
    return null;
  }

  const stageInfo = STAGE_INFO[currentStage];
  const completedStages = STAGES_ORDER.indexOf(currentStage);

  return (
    <div className={`${styles.container} ${currentStage === 'complete' ? styles.complete : ''} ${error ? styles.error : ''}`}>
      <div className={styles.header}>
        <div className={styles.statusIndicator}>
          {currentStage === 'complete' ? (
            <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : error ? (
            <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          ) : (
            <div className={styles.spinner} />
          )}
        </div>
        <div className={styles.headerText}>
          <h3 className={styles.title}>
            {error ? 'Generation Failed' : stageInfo.label}
          </h3>
          <p className={styles.description}>
            {error || stageInfo.description}
          </p>
        </div>
        {isGenerating && (
          <div className={styles.timer}>
            {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
          </div>
        )}
      </div>

      {/* Main progress bar */}
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
          <div
            className={styles.progressGlow}
            style={{ left: `${progress}%` }}
          />
        </div>
        <span className={styles.progressPercent}>{Math.round(progress)}%</span>
      </div>

      {/* Stage indicators */}
      {isGenerating && (
        <div className={styles.stages}>
          {STAGES_ORDER.map((stage, index) => (
            <div
              key={stage}
              className={`${styles.stage} ${index < completedStages ? styles.stageComplete : ''} ${currentStage === stage ? styles.stageCurrent : ''}`}
            >
              <div className={styles.stageDot}>
                {index < completedStages ? (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                ) : currentStage === stage ? (
                  <div className={styles.stagePulse} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span className={styles.stageLabel}>{STAGE_INFO[stage].label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Creative message */}
      {isGenerating && currentStage === 'rendering' && (
        <div className={styles.creativeMessage}>
          <span className={styles.sparkle}>✨</span>
          {creativeMessage}
        </div>
      )}

      {/* Prompt preview */}
      {prompt && isGenerating && (
        <div className={styles.promptPreview}>
          <span className={styles.promptLabel}>Creating:</span>
          <span className={styles.promptText}>{prompt.slice(0, 100)}{prompt.length > 100 ? '...' : ''}</span>
        </div>
      )}
    </div>
  );
}

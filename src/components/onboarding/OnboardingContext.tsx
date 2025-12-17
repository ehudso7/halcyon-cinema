/**
 * Onboarding Context
 *
 * Manages immersive onboarding state for new and free-tier users.
 * Tracks progress through the guided experience and triggers strategic
 * upgrade prompts at key moments.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export type OnboardingStep =
  | 'welcome'
  | 'create-project'
  | 'explore-writers-room'
  | 'try-ai-generation'
  | 'preview-cinema'
  | 'see-results'
  | 'upgrade-prompt'
  | 'completed';

export interface OnboardingProgress {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  hasCreatedProject: boolean;
  hasTriedWritersRoom: boolean;
  hasGeneratedContent: boolean;
  hasPreviewedCinema: boolean;
  trialCreditsUsed: number;
  trialCreditsRemaining: number;
  showUpgradePrompt: boolean;
  dismissedAt: string | null;
  completedAt: string | null;
}

export interface OnboardingContextValue {
  progress: OnboardingProgress;
  isOnboarding: boolean;
  showOnboarding: boolean;
  currentStepIndex: number;
  totalSteps: number;
  // Actions
  startOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: OnboardingStep) => void;
  markStepComplete: (step: OnboardingStep) => void;
  markProjectCreated: () => void;
  markWritersRoomTried: () => void;
  markContentGenerated: () => void;
  markCinemaPreviewed: () => void;
  useTrialCredit: () => boolean;
  showUpgrade: () => void;
  dismissOnboarding: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  'welcome',
  'create-project',
  'explore-writers-room',
  'try-ai-generation',
  'preview-cinema',
  'see-results',
  'upgrade-prompt',
  'completed',
];

const TRIAL_CREDITS = 3; // Free trial generations for onboarding

const STORAGE_KEY = 'halcyon-onboarding-progress';

const defaultProgress: OnboardingProgress = {
  currentStep: 'welcome',
  completedSteps: [],
  hasCreatedProject: false,
  hasTriedWritersRoom: false,
  hasGeneratedContent: false,
  hasPreviewedCinema: false,
  trialCreditsUsed: 0,
  trialCreditsRemaining: TRIAL_CREDITS,
  showUpgradePrompt: false,
  dismissedAt: null,
  completedAt: null,
};

// ============================================================================
// Context
// ============================================================================

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface OnboardingProviderProps {
  children: ReactNode;
  isNewUser?: boolean;
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
}

export function OnboardingProvider({
  children,
  isNewUser = false,
  subscriptionTier = 'free',
}: OnboardingProviderProps) {
  const [progress, setProgress] = useState<OnboardingProgress>(defaultProgress);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load progress from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as OnboardingProgress;
        setProgress(parsed);
      } else if (isNewUser && subscriptionTier === 'free') {
        // Start fresh onboarding for new free users
        setProgress({ ...defaultProgress });
      }
    } catch {
      // Ignore localStorage errors
    }
    setIsInitialized(true);
  }, [isNewUser, subscriptionTier]);

  // Save progress to localStorage on change
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [progress, isInitialized]);

  // Determine if we should show onboarding
  const shouldShowOnboarding =
    isInitialized &&
    subscriptionTier === 'free' &&
    !progress.completedAt &&
    !progress.dismissedAt;

  const isOnboarding = shouldShowOnboarding && progress.currentStep !== 'completed';

  const currentStepIndex = ONBOARDING_STEPS.indexOf(progress.currentStep);
  const totalSteps = ONBOARDING_STEPS.length - 1; // Exclude 'completed'

  // ============================================================================
  // Actions
  // ============================================================================

  const startOnboarding = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      currentStep: 'welcome',
      dismissedAt: null,
    }));
  }, []);

  const nextStep = useCallback(() => {
    setProgress((prev) => {
      const currentIndex = ONBOARDING_STEPS.indexOf(prev.currentStep);
      const nextIndex = Math.min(currentIndex + 1, ONBOARDING_STEPS.length - 1);
      const nextStepValue = ONBOARDING_STEPS[nextIndex];

      return {
        ...prev,
        currentStep: nextStepValue,
        completedSteps: prev.completedSteps.includes(prev.currentStep)
          ? prev.completedSteps
          : [...prev.completedSteps, prev.currentStep],
      };
    });
  }, []);

  const prevStep = useCallback(() => {
    setProgress((prev) => {
      const currentIndex = ONBOARDING_STEPS.indexOf(prev.currentStep);
      const prevIndex = Math.max(currentIndex - 1, 0);
      return {
        ...prev,
        currentStep: ONBOARDING_STEPS[prevIndex],
      };
    });
  }, []);

  const goToStep = useCallback((step: OnboardingStep) => {
    setProgress((prev) => ({
      ...prev,
      currentStep: step,
    }));
  }, []);

  const markStepComplete = useCallback((step: OnboardingStep) => {
    setProgress((prev) => ({
      ...prev,
      completedSteps: prev.completedSteps.includes(step)
        ? prev.completedSteps
        : [...prev.completedSteps, step],
    }));
  }, []);

  const markProjectCreated = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      hasCreatedProject: true,
    }));
  }, []);

  const markWritersRoomTried = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      hasTriedWritersRoom: true,
    }));
  }, []);

  const markContentGenerated = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      hasGeneratedContent: true,
    }));
  }, []);

  const markCinemaPreviewed = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      hasPreviewedCinema: true,
    }));
  }, []);

  const useTrialCredit = useCallback((): boolean => {
    let success = false;
    setProgress((prev) => {
      if (prev.trialCreditsRemaining > 0) {
        success = true;
        return {
          ...prev,
          trialCreditsUsed: prev.trialCreditsUsed + 1,
          trialCreditsRemaining: prev.trialCreditsRemaining - 1,
        };
      }
      return prev;
    });
    return success;
  }, []);

  const showUpgrade = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      showUpgradePrompt: true,
      currentStep: 'upgrade-prompt',
    }));
  }, []);

  const dismissOnboarding = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      dismissedAt: new Date().toISOString(),
    }));
  }, []);

  const completeOnboarding = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      currentStep: 'completed',
      completedAt: new Date().toISOString(),
    }));
  }, []);

  const resetOnboarding = useCallback(() => {
    setProgress({ ...defaultProgress });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: OnboardingContextValue = {
    progress,
    isOnboarding,
    showOnboarding: shouldShowOnboarding,
    currentStepIndex,
    totalSteps,
    startOnboarding,
    nextStep,
    prevStep,
    goToStep,
    markStepComplete,
    markProjectCreated,
    markWritersRoomTried,
    markContentGenerated,
    markCinemaPreviewed,
    useTrialCredit,
    showUpgrade,
    dismissOnboarding,
    completeOnboarding,
    resetOnboarding,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export default OnboardingContext;

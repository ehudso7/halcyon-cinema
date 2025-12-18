import { useEffect, useState } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { SessionProvider, useSession } from 'next-auth/react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import { OnboardingProvider, OnboardingModal } from '@/components/onboarding';
import Footer from '@/components/Footer';
import '@/styles/globals.css';

// Pages that should not show the footer
const noFooterPages = ['/auth/signin', '/auth/signup', '/auth/error', '/landing'];

// Hook to reset scroll position on route changes
function useScrollReset() {
  const router = useRouter();

  useEffect(() => {
    // Reset scroll to top on route change
    const handleRouteChange = () => {
      // Use setTimeout to ensure DOM is updated before scrolling
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 0);
    };

    // Also reset on initial load
    if (typeof window !== 'undefined') {
      window.history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
    }

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);
}

// Pages that should not show onboarding
const noOnboardingPages = ['/auth/signin', '/auth/signup', '/auth/error', '/landing', '/pricing', '/onboarding'];

// Apply saved preferences on app load
function usePreferencesInitialization() {
  useEffect(() => {
    // Load theme preference
    const savedTheme = localStorage.getItem('halcyon-theme');
    if (savedTheme) {
      if (savedTheme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
    }

    // Load accessibility settings
    const savedAccessibility = localStorage.getItem('halcyon-accessibility');
    if (savedAccessibility) {
      try {
        const settings = JSON.parse(savedAccessibility);
        if (settings.fontSize) {
          document.documentElement.setAttribute('data-font-size', settings.fontSize);
        }
        if (settings.reducedMotion) {
          document.documentElement.setAttribute('data-reduced-motion', 'true');
        }
        if (settings.highContrast) {
          document.documentElement.setAttribute('data-high-contrast', 'true');
        }
      } catch {
        // Ignore parsing errors
      }
    }

    // Load language preference
    const savedLanguage = localStorage.getItem('halcyon-language');
    if (savedLanguage) {
      document.documentElement.lang = savedLanguage;
    }

    // Listen for system theme changes when using 'system' preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const currentTheme = localStorage.getItem('halcyon-theme');
      if (currentTheme === 'system') {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
}

// Inner app wrapper that has access to session
function AppContent({ Component, pageProps, showFooter, showOnboarding }: {
  Component: AppProps['Component'];
  pageProps: Record<string, unknown>;
  showFooter: boolean;
  showOnboarding: boolean;
}) {
  const { data: session, status } = useSession();
  const [hasOnboardingProgress, setHasOnboardingProgress] = useState(true); // Default to true to prevent flash

  // Check localStorage on client side
  useEffect(() => {
    const progress = localStorage.getItem('halcyon-onboarding-progress');
    setHasOnboardingProgress(!!progress);
  }, []);

  // Determine user state for onboarding
  // User is considered new if: logged in, session loaded, and no previous onboarding progress
  const isNewUser = status === 'authenticated' && session?.user && !hasOnboardingProgress;
  const subscriptionTier = (session?.user as { subscriptionTier?: string })?.subscriptionTier as 'starter' | 'pro' | 'enterprise' || 'starter';

  return (
    <OnboardingProvider
      isNewUser={Boolean(isNewUser)}
      subscriptionTier={subscriptionTier}
    >
      <div className="app-layout">
        <Component {...pageProps} />
        {showFooter && <Footer />}
        {showOnboarding && <OnboardingModal />}
      </div>
    </OnboardingProvider>
  );
}

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const router = useRouter();
  const showFooter = !noFooterPages.includes(router.pathname);
  const showOnboarding = !noOnboardingPages.includes(router.pathname);

  // Initialize preferences (theme, accessibility, language) from localStorage
  usePreferencesInitialization();

  // Reset scroll position on route changes to prevent pages loading at wrong position
  useScrollReset();

  return (
    <SessionProvider session={session}>
      <ErrorBoundary>
        <ToastProvider>
          <AppContent
            Component={Component}
            pageProps={pageProps}
            showFooter={showFooter}
            showOnboarding={showOnboarding}
          />
        </ToastProvider>
      </ErrorBoundary>
    </SessionProvider>
  );
}

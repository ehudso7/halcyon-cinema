import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { SessionProvider } from 'next-auth/react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import Footer from '@/components/Footer';
import '@/styles/globals.css';

// Pages that should not show the footer
const noFooterPages = ['/auth/signin', '/auth/signup', '/auth/error'];

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

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const router = useRouter();
  const showFooter = !noFooterPages.includes(router.pathname);

  // Initialize preferences (theme, accessibility, language) from localStorage
  usePreferencesInitialization();

  return (
    <SessionProvider session={session}>
      <ErrorBoundary>
        <ToastProvider>
          <div className="app-layout">
            <Component {...pageProps} />
            {showFooter && <Footer />}
          </div>
        </ToastProvider>
      </ErrorBoundary>
    </SessionProvider>
  );
}

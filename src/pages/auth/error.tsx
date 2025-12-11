import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/Auth.module.css';

interface ErrorInfo {
  title: string;
  message: string;
  suggestion: string;
  icon: 'lock' | 'alert' | 'clock' | 'server' | 'user';
}

const errorMessages: Record<string, ErrorInfo> = {
  Configuration: {
    title: 'Configuration Error',
    message: 'There is a problem with the server configuration.',
    suggestion: 'Please contact support if this issue persists.',
    icon: 'server',
  },
  AccessDenied: {
    title: 'Access Denied',
    message: 'You do not have permission to access this resource.',
    suggestion: 'Please verify your account or contact support for assistance.',
    icon: 'lock',
  },
  Verification: {
    title: 'Link Expired',
    message: 'The sign in link is no longer valid.',
    suggestion: 'It may have been used already or expired. Please request a new link.',
    icon: 'clock',
  },
  CredentialsSignin: {
    title: 'Invalid Credentials',
    message: 'The email or password you entered is incorrect.',
    suggestion: 'Please check your credentials and try again.',
    icon: 'user',
  },
  SessionRequired: {
    title: 'Session Required',
    message: 'You need to be signed in to access this page.',
    suggestion: 'Please sign in with your account to continue.',
    icon: 'lock',
  },
  OAuthSignin: {
    title: 'OAuth Error',
    message: 'There was a problem signing in with the external provider.',
    suggestion: 'Please try again or use a different sign in method.',
    icon: 'alert',
  },
  OAuthCallback: {
    title: 'OAuth Callback Error',
    message: 'There was an error during the authentication callback.',
    suggestion: 'Please try again or use email sign in instead.',
    icon: 'alert',
  },
  OAuthCreateAccount: {
    title: 'Account Creation Failed',
    message: 'Unable to create your account with the external provider.',
    suggestion: 'You may need to sign up with email instead.',
    icon: 'user',
  },
  EmailCreateAccount: {
    title: 'Account Creation Failed',
    message: 'Unable to create your account with this email.',
    suggestion: 'This email may already be registered. Try signing in instead.',
    icon: 'user',
  },
  Callback: {
    title: 'Callback Error',
    message: 'There was an error during authentication.',
    suggestion: 'Please try again.',
    icon: 'alert',
  },
  Default: {
    title: 'Authentication Error',
    message: 'An unexpected error occurred during authentication.',
    suggestion: 'Please try again or contact support if the issue persists.',
    icon: 'alert',
  },
};

const troubleshootingTips = [
  'Clear your browser cache and cookies',
  'Try using a different browser',
  'Disable browser extensions temporarily',
  'Check if your network connection is stable',
  'Make sure JavaScript is enabled',
];

function ErrorIcon({ type }: { type: ErrorInfo['icon'] }) {
  const icons = {
    lock: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
    alert: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    clock: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    server: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
    user: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
        <line x1="4" y1="4" x2="20" y2="20" />
      </svg>
    ),
  };

  return icons[type] || icons.alert;
}

export default function AuthError() {
  const router = useRouter();
  const { error } = router.query;
  const [showTips, setShowTips] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const errorInfo: ErrorInfo =
    error && typeof error === 'string'
      ? errorMessages[error] || errorMessages.Default
      : errorMessages.Default;

  // Auto-redirect countdown for session required
  useEffect(() => {
    if (error === 'SessionRequired') {
      setCountdown(10);
    }
  }, [error]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      router.push('/auth/signin');
    }
  }, [countdown, router]);

  return (
    <>
      <Head>
        <title>{errorInfo.title} | HALCYON-Cinema</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className={styles.container}>
        {/* Animated background elements */}
        <div className={styles.bgDecoration}>
          <div className={styles.bgCircle1} />
          <div className={styles.bgCircle2} />
          <div className={styles.bgCircle3} />
        </div>

        <div className={styles.errorCard}>
          <div className={styles.errorIconWrapper}>
            <div className={styles.errorIconBg}>
              <ErrorIcon type={errorInfo.icon} />
            </div>
          </div>

          <h1 className={styles.errorTitle}>{errorInfo.title}</h1>
          <p className={styles.errorMessage}>{errorInfo.message}</p>
          <p className={styles.errorSuggestion}>{errorInfo.suggestion}</p>

          {error && (
            <div className={styles.errorCode}>
              <span>Error Code:</span> {error}
            </div>
          )}

          {countdown !== null && (
            <div className={styles.countdown}>
              Redirecting to sign in in {countdown} seconds...
            </div>
          )}

          <div className={styles.errorActions}>
            <Link href="/auth/signin" className={styles.primaryAction}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Try Again
            </Link>
            <Link href="/landing" className={styles.secondaryAction}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Go to Home
            </Link>
          </div>

          <div className={styles.helpSection}>
            <button
              onClick={() => setShowTips(!showTips)}
              className={styles.helpToggle}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Troubleshooting Tips
              <svg
                className={`${styles.chevron} ${showTips ? styles.chevronOpen : ''}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showTips && (
              <ul className={styles.tipsList}>
                {troubleshootingTips.map((tip, index) => (
                  <li key={index}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 11 12 14 22 4" />
                      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                    </svg>
                    {tip}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.supportSection}>
            <p>
              Still having trouble?{' '}
              <a href="mailto:support@halcyon-cinema.com">Contact Support</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

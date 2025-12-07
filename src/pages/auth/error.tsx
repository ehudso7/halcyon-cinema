import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/Auth.module.css';

const errorMessages: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration. Please contact support.',
  AccessDenied: 'You do not have permission to sign in.',
  Verification: 'The sign in link is no longer valid. It may have been used already or expired.',
  Default: 'An authentication error occurred. Please try again.',
  CredentialsSignin: 'Invalid email or password. Please try again.',
  SessionRequired: 'Please sign in to access this page.',
};

export default function AuthError() {
  const router = useRouter();
  const { error } = router.query;

  const errorMessage = error && typeof error === 'string'
    ? errorMessages[error] || errorMessages.Default
    : errorMessages.Default;

  return (
    <>
      <Head>
        <title>Authentication Error | HALCYON-Cinema</title>
      </Head>

      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🎬</span>
            <h1 className={styles.logoText}>HALCYON-Cinema</h1>
          </div>

          <h2 className={styles.title}>Authentication Error</h2>
          <p className={styles.subtitle}>{errorMessage}</p>

          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Link href="/auth/signin" className="btn btn-primary" style={{ textAlign: 'center' }}>
              Try Again
            </Link>
            <Link href="/landing" className="btn btn-secondary" style={{ textAlign: 'center' }}>
              Go to Home
            </Link>
          </div>

          <p className={styles.footer}>
            Need help?{' '}
            <a href="mailto:support@halcyon-cinema.com">Contact Support</a>
          </p>
        </div>
      </div>
    </>
  );
}

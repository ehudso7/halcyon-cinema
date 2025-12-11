import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import styles from '@/styles/Error.module.css';

export default function Custom404() {
  const { data: session } = useSession();
  const [glitchActive, setGlitchActive] = useState(false);

  // Occasional glitch effect
  useEffect(() => {
    const interval = setInterval(() => {
      setGlitchActive(true);
      setTimeout(() => setGlitchActive(false), 200);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Head>
        <title>Page Not Found | HALCYON-Cinema</title>
        <meta name="description" content="The page you're looking for doesn't exist or may have been moved." />
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <div className={styles.errorPage}>
            <div className={`${styles.errorCode} ${glitchActive ? styles.glitchEffect : ''}`}>
              404
            </div>

            <h1 className={styles.title}>Scene Not Found</h1>
            <p className={styles.subtitle}>
              The page you&apos;re looking for doesn&apos;t exist or may have been moved.
              {!session && ' If you had a project here, please sign in to access your work.'}
            </p>

            <div className={styles.actions}>
              <Link href="/" className="btn btn-primary" aria-label="Go to Dashboard">
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Go to Dashboard
              </Link>
              {!session && (
                <Link href="/auth/signin" className="btn btn-secondary" aria-label="Sign In">
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Sign In
                </Link>
              )}
            </div>

            <div className={styles.infoBox}>
              <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Looking for your project?
              </h3>
              <p>
                If you previously created a project and it&apos;s no longer available, the data may have been
                cleared due to server maintenance or session expiration. Create a new project to continue your cinematic journey.
              </p>
            </div>

            <div className={styles.helpSection}>
              <p className={styles.helpTitle}>Quick Links</p>
              <div className={styles.helpLinks}>
                <Link href="/" className={styles.helpLink}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                    <line x1="7" y1="2" x2="7" y2="22" />
                    <line x1="17" y1="2" x2="17" y2="22" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                  </svg>
                  My Projects
                </Link>
                <Link href="/landing" className={styles.helpLink}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="10 8 16 12 10 16 10 8" />
                  </svg>
                  Learn More
                </Link>
                {session && (
                  <Link href="/settings" className={styles.helpLink}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                    Settings
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.filmStrip} aria-hidden="true" />
      </main>
    </>
  );
}

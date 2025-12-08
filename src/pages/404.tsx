import Link from 'next/link';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';

export default function Custom404() {
  const { data: session } = useSession();

  return (
    <>
      <Head>
        <title>Page Not Found | HALCYON-Cinema</title>
      </Head>

      <Header />

      <main className="page">
        <div className="container" style={{ textAlign: 'center', paddingTop: '80px' }}>
          <div style={{
            fontSize: '120px',
            lineHeight: 1,
            marginBottom: '24px',
            opacity: 0.3
          }}>
            404
          </div>
          <h1 style={{
            fontSize: '2rem',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Page Not Found
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            marginBottom: '32px',
            maxWidth: '500px',
            margin: '0 auto 32px'
          }}>
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
            {!session && ' If you had a project here, your data may have been cleared due to temporary storage.'}
          </p>

          <div style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
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

          <div style={{
            marginTop: '60px',
            padding: '24px',
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            maxWidth: '500px',
            margin: '60px auto 0'
          }}>
            <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>Looking for your project?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              If you previously created a project and it&apos;s no longer available, the data may have been
              cleared due to server maintenance. Create a new project to continue your cinematic journey.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

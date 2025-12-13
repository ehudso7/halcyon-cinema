import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/Auth.module.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <Head>
          <title>Check Your Email | HALCYON-Cinema</title>
        </Head>
        <div className={styles.authContainer}>
          <div className={styles.authCard}>
            <div className={styles.successIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h1 className={styles.title}>Check Your Email</h1>
            <p className={styles.description}>
              If an account exists for <strong>{email}</strong>, you will receive a password reset link shortly.
            </p>
            <p className={styles.description}>
              Didn&apos;t receive an email? Check your spam folder or try again.
            </p>
            <div className={styles.actions}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSuccess(false);
                  setEmail('');
                }}
              >
                Try Again
              </button>
              <Link href="/auth/signin" className="btn btn-primary">
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Reset Password | HALCYON-Cinema</title>
        <meta name="description" content="Reset your HALCYON-Cinema password" />
      </Head>

      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <Link href="/" className={styles.logo}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="7" y2="7" />
              <line x1="2" y1="17" x2="7" y2="17" />
              <line x1="17" y1="17" x2="22" y2="17" />
              <line x1="17" y1="7" x2="22" y2="7" />
            </svg>
            <span>HALCYON-Cinema</span>
          </Link>

          <h1 className={styles.title}>Reset Password</h1>
          <p className={styles.description}>
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>

          {error && (
            <div className={styles.errorAlert}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={isLoading || !email}
            >
              {isLoading ? (
                <>
                  <span className={styles.spinner} />
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>

          <div className={styles.footer}>
            <p>
              Remember your password?{' '}
              <Link href="/auth/signin">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

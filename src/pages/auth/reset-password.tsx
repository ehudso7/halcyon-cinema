import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/Auth.module.css';

export default function ResetPassword() {
  const router = useRouter();
  const { token } = router.query;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (token && typeof token === 'string') {
      fetch(`/api/auth/verify-reset-token?token=${token}`)
        .then(res => res.json())
        .then(data => {
          setTokenValid(data.valid);
          if (!data.valid) {
            setError(data.error || 'Invalid or expired reset link');
          }
        })
        .catch(() => {
          setTokenValid(false);
          setError('Failed to verify reset link');
        });
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
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
          <title>Password Reset Successful | HALCYON-Cinema</title>
        </Head>
        <div className={styles.authContainer}>
          <div className={styles.authCard}>
            <div className={styles.successIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h1 className={styles.title}>Password Reset!</h1>
            <p className={styles.description}>
              Your password has been successfully reset. You can now sign in with your new password.
            </p>
            <Link href="/auth/signin" className="btn btn-primary btn-full">
              Sign In
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (tokenValid === false) {
    return (
      <>
        <Head>
          <title>Invalid Reset Link | HALCYON-Cinema</title>
        </Head>
        <div className={styles.authContainer}>
          <div className={styles.authCard}>
            <div className={styles.errorIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h1 className={styles.title}>Invalid Reset Link</h1>
            <p className={styles.description}>
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <div className={styles.actions}>
              <Link href="/auth/forgot-password" className="btn btn-primary">
                Request New Link
              </Link>
              <Link href="/auth/signin" className="btn btn-secondary">
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
        <title>Set New Password | HALCYON-Cinema</title>
        <meta name="description" content="Set your new HALCYON-Cinema password" />
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

          <h1 className={styles.title}>Set New Password</h1>
          <p className={styles.description}>
            Enter your new password below.
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
              <label htmlFor="password">New Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
                autoFocus
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={isLoading || !password || !confirmPassword || tokenValid !== true}
            >
              {isLoading ? (
                <>
                  <span className={styles.spinner} />
                  Resetting...
                </>
              ) : tokenValid === null ? (
                'Verifying link...'
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

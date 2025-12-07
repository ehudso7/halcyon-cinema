import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/Auth.module.css';

export default function SignUp() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      // Register user
      const registerResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!registerResponse.ok) {
        const data = await registerResponse.json();
        throw new Error(data.error || 'Failed to create account');
      }

      // Sign in automatically
      const signInResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        throw new Error('Account created but sign in failed');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Create Account | HALCYON-Cinema</title>
      </Head>

      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🎬</span>
            <h1 className={styles.logoText}>HALCYON-Cinema</h1>
          </div>

          <h2 className={styles.title}>Create your account</h2>
          <p className={styles.subtitle}>Start building cinematic content with AI</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="name" className={styles.label}>
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="input"
                required
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="input"
                required
                minLength={8}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
                required
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={`btn btn-primary ${styles.submitBtn}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className={styles.footer}>
            Already have an account?{' '}
            <Link href="/auth/signin">Sign in</Link>
          </p>
        </div>
      </div>
    </>
  );
}

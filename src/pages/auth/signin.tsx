import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/Auth.module.css';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        router.push('/');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign In | HALCYON-Cinema</title>
      </Head>

      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🎬</span>
            <h1 className={styles.logoText}>HALCYON-Cinema</h1>
          </div>

          <h2 className={styles.title}>Welcome back</h2>
          <p className={styles.subtitle}>Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className={styles.form}>
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
                autoFocus
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
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className={styles.footer}>
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup">Create one</Link>
          </p>
        </div>
      </div>
    </>
  );
}

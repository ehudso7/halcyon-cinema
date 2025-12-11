import { useState, FormEvent } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UsageStats from '@/components/UsageStats';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import styles from '@/styles/Settings.module.css';

interface SettingsProps {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export default function Settings({ user }: SettingsProps) {
  const [name, setName] = useState(user.name);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>Settings | HALCYON-Cinema</title>
        <meta name="description" content="Manage your HALCYON-Cinema account settings" />
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <div className={styles.header}>
            <h1 className={styles.title}>Settings</h1>
            <p className={styles.subtitle}>Manage your account and preferences</p>
          </div>

          <div className={styles.grid}>
            {/* Profile Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Profile
              </h2>
              <form onSubmit={handleUpdateProfile} className={styles.form}>
                <div className={styles.field}>
                  <label htmlFor="email" className={styles.label}>Email</label>
                  <input
                    id="email"
                    type="email"
                    value={user.email}
                    className="input"
                    disabled
                  />
                  <p className={styles.hint}>Email cannot be changed</p>
                </div>
                <div className={styles.field}>
                  <label htmlFor="name" className={styles.label}>Display Name</label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                    placeholder="Your name"
                  />
                </div>
                {message && (
                  <p className={`${styles.message} ${styles[message.type]}`}>
                    {message.text}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving || name === user.name}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </section>

            {/* Usage Stats Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Usage & Credits
              </h2>
              <div className={styles.statsContainer}>
                <UsageStats />
              </div>
            </section>

            {/* Quick Links Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
                Quick Links
              </h2>
              <div className={styles.links}>
                <Link href="/" className={styles.linkItem}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    <polyline points="9,22 9,12 15,12 15,22" />
                  </svg>
                  <div>
                    <span className={styles.linkTitle}>Dashboard</span>
                    <span className={styles.linkDesc}>View all your projects</span>
                  </div>
                </Link>
                <Link href="/api/health" target="_blank" className={styles.linkItem}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  <div>
                    <span className={styles.linkTitle}>API Status</span>
                    <span className={styles.linkDesc}>Check system health</span>
                  </div>
                </Link>
                <Link href="/terms" className={styles.linkItem}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                  </svg>
                  <div>
                    <span className={styles.linkTitle}>Terms of Service</span>
                    <span className={styles.linkDesc}>Review our terms</span>
                  </div>
                </Link>
                <Link href="/privacy" className={styles.linkItem}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  <div>
                    <span className={styles.linkTitle}>Privacy Policy</span>
                    <span className={styles.linkDesc}>How we handle your data</span>
                  </div>
                </Link>
              </div>
            </section>

            {/* Danger Zone */}
            <section className={`${styles.section} ${styles.danger}`}>
              <h2 className={styles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Danger Zone
              </h2>
              <p className={styles.dangerText}>
                These actions are irreversible. Please proceed with caution.
              </p>
              <button
                className={`btn ${styles.dangerBtn}`}
                onClick={() => alert('Account deletion is not yet implemented. Contact support for assistance.')}
              >
                Delete Account
              </button>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps<SettingsProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session?.user?.id) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }

  return {
    props: {
      user: {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.name || '',
      },
    },
  };
};

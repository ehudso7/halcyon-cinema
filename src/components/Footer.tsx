'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import BrandLogo from './BrandLogo';
import styles from './Footer.module.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { data: session } = useSession();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.main}>
          <div className={styles.brand}>
            <Link href="/" className={styles.logo}>
              <BrandLogo size="medium" />
            </Link>
            <p className={styles.tagline}>
              The future of visual storytelling
            </p>
          </div>

          <div className={styles.links}>
            <div className={styles.linkGroup}>
              <h4 className={styles.linkTitle}>Product</h4>
              <Link href="/" className={styles.link}>
                {session ? 'Dashboard' : 'Projects'}
              </Link>
              {session ? (
                <Link href="/settings" className={styles.link}>Settings</Link>
              ) : (
                <>
                  <Link href="/auth/signin" className={styles.link}>Sign In</Link>
                  <Link href="/auth/signup" className={styles.link}>Get Started</Link>
                </>
              )}
            </div>

            <div className={styles.linkGroup}>
              <h4 className={styles.linkTitle}>Legal</h4>
              <Link href="/terms" className={styles.link}>Terms of Service</Link>
              <Link href="/privacy" className={styles.link}>Privacy Policy</Link>
            </div>

            <div className={styles.linkGroup}>
              <h4 className={styles.linkTitle}>Resources</h4>
              <Link href="/api/health" className={styles.link}>API Status</Link>
              <a
                href="https://github.com/ehudso7/halcyon-cinema"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                GitHub
              </a>
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <p className={styles.copyright}>
            &copy; {currentYear} HALCYON-Cinema. All rights reserved.
          </p>
          <div className={styles.badges}>
            <span className={styles.badge}>Next.js 16</span>
            <span className={styles.badge}>TypeScript</span>
            <span className={styles.badge}>GPT Image 1</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

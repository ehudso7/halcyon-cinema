import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.main}>
          <div className={styles.brand}>
            <Link href="/" className={styles.logo}>
              <span className={styles.logoIcon}>🎬</span>
              <span className={styles.logoText}>HALCYON-Cinema</span>
            </Link>
            <p className={styles.tagline}>
              AI-powered cinematic content creation studio
            </p>
          </div>

          <div className={styles.links}>
            <div className={styles.linkGroup}>
              <h4 className={styles.linkTitle}>Product</h4>
              <Link href="/" className={styles.link}>Projects</Link>
              <Link href="/auth/signin" className={styles.link}>Sign In</Link>
              <Link href="/auth/signup" className={styles.link}>Get Started</Link>
            </div>

            <div className={styles.linkGroup}>
              <h4 className={styles.linkTitle}>Resources</h4>
              <Link href="/api/health" className={styles.link}>API Status</Link>
              <a
                href="https://github.com"
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
            <span className={styles.badge}>Next.js 14</span>
            <span className={styles.badge}>TypeScript</span>
            <span className={styles.badge}>OpenAI</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

import Link from 'next/link';
import styles from './Header.module.css';

interface HeaderProps {
  showBackLink?: boolean;
  backLinkHref?: string;
  backLinkText?: string;
}

export default function Header({ showBackLink, backLinkHref = '/', backLinkText = 'Back' }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.left}>
          {showBackLink && (
            <Link href={backLinkHref} className={styles.backLink}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              {backLinkText}
            </Link>
          )}
        </div>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>🎬</span>
          <span className={styles.logoText}>HALCYON-Cinema</span>
        </Link>
        <div className={styles.right}>
          <Link href="/" className={styles.navLink}>
            Projects
          </Link>
        </div>
      </div>
    </header>
  );
}

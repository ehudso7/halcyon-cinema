import { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import styles from './Header.module.css';

interface HeaderProps {
  showBackLink?: boolean;
  backLinkHref?: string;
  backLinkText?: string;
}

export default function Header({ showBackLink, backLinkHref = '/', backLinkText = 'Back' }: HeaderProps) {
  const { data: session, status } = useSession();
  const [showDropdown, setShowDropdown] = useState(false);

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

          {status === 'loading' ? (
            <div className={styles.authLoading}>
              <span className="spinner" />
            </div>
          ) : session ? (
            <div className={styles.userMenu}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className={styles.userButton}
              >
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className={styles.avatar}
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {(session.user?.name?.[0] || session.user?.email?.[0] || 'U').toUpperCase()}
                  </div>
                )}
                <span className={styles.userName}>{session.user?.name || 'User'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {showDropdown && (
                <>
                  <div className={styles.dropdownOverlay} onClick={() => setShowDropdown(false)} />
                  <div className={styles.dropdown}>
                    <div className={styles.dropdownHeader}>
                      <span className={styles.dropdownName}>{session.user?.name}</span>
                      <span className={styles.dropdownEmail}>{session.user?.email}</span>
                    </div>
                    <div className={styles.dropdownDivider} />
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className={styles.dropdownItem}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className={styles.authButtons}>
              <Link href="/auth/signin" className={styles.signInBtn}>
                Sign In
              </Link>
              <Link href="/auth/signup" className={`btn btn-primary ${styles.signUpBtn}`}>
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

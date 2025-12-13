import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import UsageStats from './UsageStats';
import BrandLogo from './BrandLogo';
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              {backLinkText}
            </Link>
          )}
        </div>
        <Link href="/" className={styles.logo}>
          <BrandLogo size="small" />
        </Link>
        <div className={styles.right}>
          <Link href="/" className={styles.navLink}>
            Projects
          </Link>
          <Link href="/library" className={styles.navLink}>
            Library
          </Link>
          <Link href="/pricing" className={styles.navLink}>
            Pricing
          </Link>

          {status === 'loading' ? (
            <div className={styles.authLoading}>
              <span className="spinner" />
            </div>
          ) : session ? (
            <>
              <UsageStats compact />
              <div className={styles.userMenu}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className={styles.userButton}
              >
                {session.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className={styles.avatar}
                    width={32}
                    height={32}
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {(session.user?.name?.[0] || session.user?.email?.[0] || 'U').toUpperCase()}
                  </div>
                )}
                <span className={styles.userName}>{session.user?.name || 'User'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
                    <Link
                      href="/settings"
                      className={styles.dropdownItem}
                      onClick={() => setShowDropdown(false)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                      </svg>
                      Settings
                    </Link>
                    <Link
                      href="/api/health"
                      className={styles.dropdownItem}
                      onClick={() => setShowDropdown(false)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                      API Status
                    </Link>
                    <Link
                      href="/terms"
                      className={styles.dropdownItem}
                      onClick={() => setShowDropdown(false)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10,9 9,9 8,9" />
                      </svg>
                      Terms & Privacy
                    </Link>
                    <div className={styles.dropdownDivider} />
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className={styles.dropdownItem}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
            </>
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

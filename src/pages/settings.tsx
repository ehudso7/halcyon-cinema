import { useState, useRef, FormEvent, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { signOut, useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import UsageStats from '@/components/UsageStats';
import { useToast } from '@/components/Toast';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import styles from '@/styles/Settings.module.css';

interface SettingsProps {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string;
  };
}

type Theme = 'dark' | 'light' | 'system';

export default function Settings({ user }: SettingsProps) {
  const { showToast } = useToast();
  const { update: updateSession } = useSession();

  // Profile state
  const [name, setName] = useState(user.name);
  const [savedName, setSavedName] = useState(user.name);
  const [avatar, setAvatar] = useState<string | null>(user.image || null);
  const [savedAvatar, setSavedAvatar] = useState<string | null>(user.image || null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to resize image for avatar - preserves PNG transparency
  const resizeImage = (dataUrl: string, maxSize: number = 128, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Calculate dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Preserve original format (PNG for transparency, JPEG for photos)
        const mimeType = dataUrl.match(/data:(image\/[^;]+)/)?.[1] || 'image/jpeg';
        const outputFormat = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(outputFormat, quality));
      };
      img.onerror = () => {
        // Return original on error or reject with error
        reject(new Error('Failed to load image for resizing'));
      };
      img.src = dataUrl;
    });
  };

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Theme state
  const [theme, setTheme] = useState<Theme>('dark');

  // Notification preferences
  const [notifications, setNotifications] = useState({
    emailUpdates: true,
    projectAlerts: true,
    weeklyDigest: false,
  });

  // Accessibility settings
  type FontSize = 'small' | 'medium' | 'large';
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  // Language preference
  type Language = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh';
  const [language, setLanguage] = useState<Language>('en');

  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('halcyon-theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Load notification preferences from localStorage
  useEffect(() => {
    const savedNotifications = localStorage.getItem('halcyon-notifications');
    if (savedNotifications) {
      try {
        setNotifications(JSON.parse(savedNotifications));
      } catch {
        // Use defaults if parsing fails
      }
    }
  }, []);

  // Load accessibility settings from localStorage
  useEffect(() => {
    const savedAccessibility = localStorage.getItem('halcyon-accessibility');
    if (savedAccessibility) {
      try {
        const settings = JSON.parse(savedAccessibility);
        if (settings.fontSize) setFontSize(settings.fontSize);
        if (settings.reducedMotion !== undefined) setReducedMotion(settings.reducedMotion);
        if (settings.highContrast !== undefined) setHighContrast(settings.highContrast);

        // Apply settings to document
        document.documentElement.setAttribute('data-font-size', settings.fontSize || 'medium');
        if (settings.reducedMotion) {
          document.documentElement.setAttribute('data-reduced-motion', 'true');
        }
        if (settings.highContrast) {
          document.documentElement.setAttribute('data-high-contrast', 'true');
        }
      } catch {
        // Use defaults if parsing fails
      }
    }
  }, []);

  // Load language preference from localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem('halcyon-language') as Language;
    if (savedLanguage) {
      setLanguage(savedLanguage);
      document.documentElement.lang = savedLanguage;
    }
  }, []);

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Only send image if it's changed from what's saved
      const imageChanged = avatar !== savedAvatar;
      const payload: { name: string; image?: string | null } = { name };

      if (imageChanged) {
        payload.image = avatar;
      }

      const response = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      // Update local state
      setSavedName(name);
      if (imageChanged) {
        setSavedAvatar(avatar);
      }

      // Update NextAuth session to persist changes across page loads
      await updateSession({
        name,
        image: avatar,
      });

      showToast('Profile updated successfully!', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update profile. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Account for base64 encoding overhead (~33% increase)
      // API limit is 4MB, so stay under ~3MB for the original file
      if (file.size > 3 * 1024 * 1024) {
        showToast('Image must be less than 3MB', 'error');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        try {
          // Resize image to 128x128 for avatar
          const resized = await resizeImage(dataUrl, 128);
          setAvatar(resized);
        } catch {
          showToast('Failed to process image. Please try a different file.', 'error');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatar(null);
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password changed successfully!', 'success');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('halcyon-theme', newTheme);

    // Apply theme to document
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', newTheme);
    }

    showToast(`Theme changed to ${newTheme}`, 'success');
  };

  const handleNotificationChange = (key: keyof typeof notifications) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    localStorage.setItem('halcyon-notifications', JSON.stringify(updated));
  };

  const handleFontSizeChange = (newSize: FontSize) => {
    setFontSize(newSize);
    const settings = { fontSize: newSize, reducedMotion, highContrast };
    localStorage.setItem('halcyon-accessibility', JSON.stringify(settings));
    document.documentElement.setAttribute('data-font-size', newSize);
    showToast(`Font size changed to ${newSize}`, 'success');
  };

  const handleReducedMotionChange = () => {
    const newValue = !reducedMotion;
    setReducedMotion(newValue);
    const settings = { fontSize, reducedMotion: newValue, highContrast };
    localStorage.setItem('halcyon-accessibility', JSON.stringify(settings));
    if (newValue) {
      document.documentElement.setAttribute('data-reduced-motion', 'true');
    } else {
      document.documentElement.removeAttribute('data-reduced-motion');
    }
  };

  const handleHighContrastChange = () => {
    const newValue = !highContrast;
    setHighContrast(newValue);
    const settings = { fontSize, reducedMotion, highContrast: newValue };
    localStorage.setItem('halcyon-accessibility', JSON.stringify(settings));
    if (newValue) {
      document.documentElement.setAttribute('data-high-contrast', 'true');
    } else {
      document.documentElement.removeAttribute('data-high-contrast');
    }
  };

  const handleLanguageChange = (newLanguage: Language) => {
    setLanguage(newLanguage);
    localStorage.setItem('halcyon-language', newLanguage);
    document.documentElement.lang = newLanguage;
    showToast('Language preference saved', 'success');
  };

  const handleExportData = async () => {
    setIsExporting(true);

    try {
      const response = await fetch('/api/auth/export-data');

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `halcyon-data-${user.id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('Data exported successfully!', 'success');
    } catch {
      showToast('Failed to export data. Please try again.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      showToast('Account deleted. Goodbye!', 'success');
      setTimeout(() => {
        signOut({ callbackUrl: '/landing' });
      }, 1500);
    } catch {
      showToast('Failed to delete account. Please try again.', 'error');
      setIsDeleting(false);
    }
  };

  const hasProfileChanges = name !== savedName || avatar !== savedAvatar;

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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Profile
              </h2>
              <form onSubmit={handleUpdateProfile} className={styles.form}>
                {/* Avatar */}
                <div className={styles.avatarSection}>
                  <div className={styles.avatarWrapper} onClick={handleAvatarClick}>
                    {avatar ? (
                      <Image
                        src={avatar}
                        alt="Profile avatar"
                        width={80}
                        height={80}
                        className={styles.avatar}
                      />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                      </div>
                    )}
                    <div className={styles.avatarOverlay}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className={styles.hiddenInput}
                    aria-label="Upload avatar"
                  />
                  <div className={styles.avatarActions}>
                    <button type="button" onClick={handleAvatarClick} className={styles.avatarBtn}>
                      Change Photo
                    </button>
                    {avatar && (
                      <button type="button" onClick={handleRemoveAvatar} className={styles.avatarRemove}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="email" className={styles.label}>Email</label>
                  <input
                    id="email"
                    type="email"
                    value={user.email}
                    className="input"
                    disabled
                    aria-describedby="email-hint"
                  />
                  <p id="email-hint" className={styles.hint}>Email cannot be changed</p>
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
                    maxLength={50}
                  />
                  <p className={styles.hint}>{name.length}/50 characters</p>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving || !hasProfileChanges}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </section>

            {/* Password Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Security
              </h2>
              <form onSubmit={handleChangePassword} className={styles.form}>
                <div className={styles.field}>
                  <label htmlFor="currentPassword" className={styles.label}>Current Password</label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input"
                    placeholder="Enter current password"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="newPassword" className={styles.label}>New Password</label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input"
                    placeholder="Enter new password"
                    minLength={8}
                  />
                  <p className={styles.hint}>Minimum 8 characters</p>
                </div>

                <div className={styles.field}>
                  <label htmlFor="confirmPassword" className={styles.label}>Confirm New Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input"
                    placeholder="Confirm new password"
                  />
                </div>

                {passwordError && (
                  <p className={`${styles.message} ${styles.error}`}>{passwordError}</p>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                >
                  {isChangingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            </section>

            {/* Theme Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                Appearance
              </h2>
              <div className={styles.themeOptions}>
                <button
                  type="button"
                  className={`${styles.themeOption} ${theme === 'dark' ? styles.active : ''}`}
                  onClick={() => handleThemeChange('dark')}
                  aria-pressed={theme === 'dark'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  className={`${styles.themeOption} ${theme === 'light' ? styles.active : ''}`}
                  onClick={() => handleThemeChange('light')}
                  aria-pressed={theme === 'light'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  className={`${styles.themeOption} ${theme === 'system' ? styles.active : ''}`}
                  onClick={() => handleThemeChange('system')}
                  aria-pressed={theme === 'system'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <span>System</span>
                </button>
              </div>
            </section>

            {/* Notifications Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                Notifications
              </h2>
              <div className={styles.toggleList}>
                <label className={styles.toggleItem}>
                  <div className={styles.toggleInfo}>
                    <span className={styles.toggleLabel}>Email Updates</span>
                    <span className={styles.toggleDesc}>Receive updates about new features</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.emailUpdates}
                    onChange={() => handleNotificationChange('emailUpdates')}
                    className={styles.toggle}
                  />
                </label>
                <label className={styles.toggleItem}>
                  <div className={styles.toggleInfo}>
                    <span className={styles.toggleLabel}>Project Alerts</span>
                    <span className={styles.toggleDesc}>Get notified about project activity</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.projectAlerts}
                    onChange={() => handleNotificationChange('projectAlerts')}
                    className={styles.toggle}
                  />
                </label>
                <label className={styles.toggleItem}>
                  <div className={styles.toggleInfo}>
                    <span className={styles.toggleLabel}>Weekly Digest</span>
                    <span className={styles.toggleDesc}>Weekly summary of your activity</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.weeklyDigest}
                    onChange={() => handleNotificationChange('weeklyDigest')}
                    className={styles.toggle}
                  />
                </label>
              </div>
            </section>

            {/* Accessibility Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="4" />
                  <line x1="12" y1="2" x2="12" y2="4" />
                  <line x1="12" y1="20" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="4" y2="12" />
                  <line x1="20" y1="12" x2="22" y2="12" />
                </svg>
                Accessibility
              </h2>

              {/* Font Size */}
              <div className={styles.settingGroup}>
                <label className={styles.settingLabel}>Font Size</label>
                <div className={styles.themeOptions}>
                  <button
                    type="button"
                    className={`${styles.themeOption} ${fontSize === 'small' ? styles.active : ''}`}
                    onClick={() => handleFontSizeChange('small')}
                    aria-pressed={fontSize === 'small'}
                  >
                    <span style={{ fontSize: '12px' }}>A</span>
                    <span>Small</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.themeOption} ${fontSize === 'medium' ? styles.active : ''}`}
                    onClick={() => handleFontSizeChange('medium')}
                    aria-pressed={fontSize === 'medium'}
                  >
                    <span style={{ fontSize: '16px' }}>A</span>
                    <span>Medium</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.themeOption} ${fontSize === 'large' ? styles.active : ''}`}
                    onClick={() => handleFontSizeChange('large')}
                    aria-pressed={fontSize === 'large'}
                  >
                    <span style={{ fontSize: '20px' }}>A</span>
                    <span>Large</span>
                  </button>
                </div>
              </div>

              {/* Accessibility Toggles */}
              <div className={styles.toggleList}>
                <label className={styles.toggleItem}>
                  <div className={styles.toggleInfo}>
                    <span className={styles.toggleLabel}>Reduce Motion</span>
                    <span className={styles.toggleDesc}>Minimize animations and transitions</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={handleReducedMotionChange}
                    className={styles.toggle}
                  />
                </label>
                <label className={styles.toggleItem}>
                  <div className={styles.toggleInfo}>
                    <span className={styles.toggleLabel}>High Contrast</span>
                    <span className={styles.toggleDesc}>Increase visual contrast for better readability</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={highContrast}
                    onChange={handleHighContrastChange}
                    className={styles.toggle}
                  />
                </label>
              </div>
            </section>

            {/* Language Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                Language
              </h2>
              <div className={styles.field}>
                <label htmlFor="language" className={styles.label}>Display Language</label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value as Language)}
                  className="input"
                >
                  <option value="en">English</option>
                  <option value="es">Español (Spanish)</option>
                  <option value="fr">Français (French)</option>
                  <option value="de">Deutsch (German)</option>
                  <option value="ja">日本語 (Japanese)</option>
                  <option value="zh">中文 (Chinese)</option>
                </select>
                <p className={styles.hint}>Your language preference is saved. Full translation support is in development.</p>
              </div>
            </section>

            {/* Usage Stats Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
                Quick Links
              </h2>
              <div className={styles.links}>
                <Link href="/" className={styles.linkItem}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    <polyline points="9,22 9,12 15,12 15,22" />
                  </svg>
                  <div>
                    <span className={styles.linkTitle}>Dashboard</span>
                    <span className={styles.linkDesc}>View all your projects</span>
                  </div>
                </Link>
                <Link href="/api/health" target="_blank" rel="noopener noreferrer" className={styles.linkItem}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  <div>
                    <span className={styles.linkTitle}>API Status</span>
                    <span className={styles.linkDesc}>Check system health</span>
                  </div>
                </Link>
                <Link href="/terms" className={styles.linkItem}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                  </svg>
                  <div>
                    <span className={styles.linkTitle}>Terms of Service</span>
                    <span className={styles.linkDesc}>Review our terms</span>
                  </div>
                </Link>
                <Link href="/privacy" className={styles.linkItem}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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

            {/* Data Management Section */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7,10 12,15 17,10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Data Management
              </h2>
              <p className={styles.sectionDesc}>
                Export all your data including projects, scenes, and settings in JSON format.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleExportData}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <svg className={styles.spinner} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7,10 12,15 17,10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export My Data
                  </>
                )}
              </button>
            </section>

            {/* Danger Zone */}
            <section className={`${styles.section} ${styles.danger}`}>
              <h2 className={styles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Danger Zone
              </h2>
              <p className={styles.dangerText}>
                Once you delete your account, there is no going back. All your projects, scenes, and data will be permanently removed.
              </p>
              <button
                className={`btn ${styles.dangerBtn}`}
                onClick={() => setShowDeleteModal(true)}
              >
                Delete Account
              </button>
            </section>
          </div>
        </div>
      </main>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <h3>Delete Account</h3>
            </div>
            <div className={styles.modalBody}>
              <p>This action is <strong>permanent</strong> and cannot be undone. All your:</p>
              <ul>
                <li>Projects and scenes</li>
                <li>Generated images</li>
                <li>Characters and lore</li>
                <li>Account settings</li>
              </ul>
              <p>will be permanently deleted.</p>
              <div className={styles.field}>
                <label htmlFor="deleteConfirm" className={styles.label}>
                  Type <strong>DELETE</strong> to confirm
                </label>
                <input
                  id="deleteConfirm"
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="input"
                  placeholder="DELETE"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${styles.dangerBtn}`}
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
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
        image: session.user.image || undefined,
      },
    },
  };
};

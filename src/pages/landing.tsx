import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import styles from '@/styles/Landing.module.css';

export default function LandingPage() {
  const { data: session } = useSession();

  return (
    <>
      <Head>
        <title>HALCYON-Cinema | From Story to Screen — Instantly</title>
        <meta name="description" content="HALCYON is your AI-powered cinematic studio. Build entire movies, shows, and visual universes from nothing but your imagination." />
        <meta name="keywords" content="AI movie maker, storyboard app, cinematic AI, DALL-E director, film creator, GPT filmmaking, concept art, prompt-based visuals" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.page}>
        {/* Navigation */}
        <nav className={styles.nav}>
          <div className={styles.navContent}>
            <Link href="/" className={styles.logo}>
              <span className={styles.logoIcon}>🎬</span>
              <span className={styles.logoText}>HALCYON</span>
            </Link>
            <div className={styles.navLinks}>
              {session ? (
                <Link href="/" className={styles.navLink}>Dashboard</Link>
              ) : (
                <>
                  <Link href="/auth/signin" className={styles.navLink}>Log In</Link>
                  <Link href="/auth/signup" className={styles.navCta}>Try It Free</Link>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <header className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={styles.title}>HALCYON</h1>
            <p className={styles.tagline}>From Story to Screen — Instantly.</p>
            <p className={styles.subhead}>
              HALCYON is your AI-first cinematic studio. Build films, series, storyboards & trailers from natural language.
            </p>
            <div className={styles.buttons}>
              {session ? (
                <Link href="/" className={styles.btnPrimary}>
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/auth/signup" className={styles.btnPrimary}>
                    Start Your Storyboard
                  </Link>
                  <Link href="/auth/signin" className={styles.btnSecondary}>
                    Log In
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.previewCard}>
              <div className={styles.previewHeader}>
                <span className={styles.dot} style={{ background: '#ef4444' }} />
                <span className={styles.dot} style={{ background: '#f59e0b' }} />
                <span className={styles.dot} style={{ background: '#10b981' }} />
              </div>
              <div className={styles.previewContent}>
                <div className={styles.previewPrompt}>
                  "A lone samurai standing on a misty mountain peak at dawn, cherry blossoms falling..."
                </div>
                <div className={styles.previewImage}>
                  <span className={styles.previewIcon}>🎨</span>
                  <span>AI-Generated Scene</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Features Section */}
        <section className={styles.features}>
          <h2 className={styles.sectionTitle}>Create Cinematic Magic</h2>
          <div className={styles.featureGrid}>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>📝</span>
              <h3>Natural Language Prompts</h3>
              <p>Describe your scene in plain English. Our AI transforms your words into stunning visuals.</p>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>🎨</span>
              <h3>12+ Visual Styles</h3>
              <p>From Ghibli-inspired to Cyberpunk, Film Noir to Anime — choose your aesthetic.</p>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>🤖</span>
              <h3>AI Creative Assistant</h3>
              <p>Get real-time suggestions for lighting, mood, composition, and story elements.</p>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>👥</span>
              <h3>Character Tracking</h3>
              <p>Create characters and track their appearances across your entire project.</p>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>🎬</span>
              <h3>Animated Trailer Mode</h3>
              <p>Watch your scenes flow like a cinematic trailer with auto-play and transitions.</p>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>📄</span>
              <h3>Export Anywhere</h3>
              <p>Download as PDF storyboards or ZIP archives with all your images and prompts.</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className={styles.cta}>
          <h2>See Your Story Come to Life</h2>
          <p>Join thousands of creators using HALCYON to visualize their cinematic visions.</p>
          <Link href="/auth/signup" className={styles.btnPrimary}>
            Build Your First Scene
          </Link>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerContent}>
            <div className={styles.footerBrand}>
              <span className={styles.logoIcon}>🎬</span>
              <span>HALCYON-Cinema</span>
            </div>
            <p className={styles.footerText}>
              Powered by GPT-4, DALL-E 3, and Next.js on Vercel
            </p>
            <p className={styles.footerCopy}>
              Built by creators, for creators.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}

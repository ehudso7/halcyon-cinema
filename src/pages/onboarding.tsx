import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import styles from '@/styles/Onboarding.module.css';

// Genre options for quick start
const genres = [
  { id: 'fantasy', name: 'Fantasy', icon: '🏰', color: '#8B5CF6', prompt: 'An ancient wizard casting a spell in a mystical tower at twilight' },
  { id: 'scifi', name: 'Sci-Fi', icon: '🚀', color: '#06B6D4', prompt: 'A lone astronaut exploring an alien planet with two moons in the sky' },
  { id: 'noir', name: 'Film Noir', icon: '🎬', color: '#6B7280', prompt: 'A detective in a rain-soaked alley, neon signs reflecting off wet pavement' },
  { id: 'romance', name: 'Romance', icon: '💕', color: '#EC4899', prompt: 'Two strangers meeting at a cozy Paris cafe during golden hour' },
  { id: 'horror', name: 'Horror', icon: '👻', color: '#991B1B', prompt: 'An abandoned Victorian mansion shrouded in fog at midnight' },
  { id: 'action', name: 'Action', icon: '💥', color: '#EA580C', prompt: 'A hero leaping between rooftops during an epic chase sequence' },
];

// Sample generated scenes for demo
const sampleScenes = [
  {
    title: 'The Awakening',
    description: 'A young mage discovers their powers for the first time in the ancient library.',
    mood: 'Mysterious, Wonder',
    style: 'Cinematic Fantasy',
  },
  {
    title: 'First Contact',
    description: 'The crew encounters an alien vessel drifting in the asteroid field.',
    mood: 'Tense, Awe-inspiring',
    style: 'Sci-Fi Realism',
  },
  {
    title: 'The Meeting',
    description: 'Two souls destined to be together share their first glance.',
    mood: 'Romantic, Hopeful',
    style: 'Golden Hour',
  },
];

// "What you'll unlock" section showcase items
const showcaseItems = [
  {
    icon: '📝',
    title: 'Write Your Story',
    description: 'Use our AI Writer\'s Room to generate narratives, expand chapters, and maintain perfect canon consistency.',
  },
  {
    icon: '🎨',
    title: 'Visualize Scenes',
    description: 'Transform descriptions into stunning visuals with 12+ cinematic styles from Film Noir to Studio Ghibli.',
  },
  {
    icon: '🎬',
    title: 'Build Productions',
    description: 'Create complete storyboards, pitch decks, and production bibles for your film or TV project.',
  },
  {
    icon: '🎵',
    title: 'Generate Soundscapes',
    description: 'Add AI-generated music and voiceovers to bring your scenes to life with immersive audio.',
  },
];

export default function Onboarding() {
  const { status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [storyIdea, setStoryIdea] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<typeof sampleScenes[0] | null>(null);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Handle genre selection
  const handleGenreSelect = useCallback((genreId: string) => {
    const genre = genres.find(g => g.id === genreId);
    setSelectedGenre(genreId);
    if (genre) {
      setStoryIdea(genre.prompt);
    }
    setStep(2);
  }, []);

  // Simulate AI generation for demo
  const handleGenerate = useCallback(async () => {
    if (!storyIdea.trim()) return;

    setIsGenerating(true);

    // Simulate generation delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate a preview based on the genre
    const genreData = genres.find(g => g.id === selectedGenre);
    setGeneratedPreview({
      title: 'Your Scene Preview',
      description: storyIdea,
      mood: genreData?.id === 'horror' ? 'Dark, Suspenseful' :
            genreData?.id === 'romance' ? 'Warm, Intimate' :
            genreData?.id === 'scifi' ? 'Epic, Futuristic' :
            'Cinematic, Atmospheric',
      style: genreData?.name || 'Cinematic',
    });

    setIsGenerating(false);
    setStep(3);
  }, [storyIdea, selectedGenre]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  // Don't render for authenticated users (they're being redirected)
  if (status === 'authenticated') {
    return null;
  }

  return (
    <>
      <Head>
        <title>Welcome to Halcyon Cinema | Start Your Story</title>
        <meta name="description" content="Experience the future of visual storytelling. Create your first cinematic scene in seconds with AI." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.page}>
        {/* Animated background */}
        <div className={styles.backgroundGradient} />
        <div className={styles.backgroundPattern} />

        {/* Navigation */}
        <nav className={styles.nav}>
          <Link href="/landing" className={styles.logo}>
            <Image src="/images/logo.svg" alt="Halcyon Cinema logo" width={32} height={32} />
            <span>HALCYON</span>
          </Link>
          <div className={styles.navActions}>
            <Link href="/auth/signin" className={styles.signInLink}>
              Sign In
            </Link>
          </div>
        </nav>

        <main className={styles.main}>
          {/* Step 1: Choose Your Genre */}
          {step === 1 && (
            <section className={styles.stepSection}>
              <div className={styles.stepHeader}>
                <span className={styles.stepBadge}>Step 1 of 3</span>
                <h1 className={styles.heroTitle}>
                  What Story Will You Tell?
                </h1>
                <p className={styles.heroSubtitle}>
                  Choose a genre and watch your imagination come to life in seconds.
                  No sign-up required to try.
                </p>
              </div>

              <div className={styles.genreGrid}>
                {genres.map((genre) => (
                  <button
                    key={genre.id}
                    className={styles.genreCard}
                    onClick={() => handleGenreSelect(genre.id)}
                    style={{ '--genre-color': genre.color } as React.CSSProperties}
                    aria-label={`Select ${genre.name} genre`}
                  >
                    <span className={styles.genreIcon}>{genre.icon}</span>
                    <span className={styles.genreName}>{genre.name}</span>
                  </button>
                ))}
              </div>

              <p className={styles.orText}>or</p>

              <button
                className={styles.customButton}
                onClick={() => setStep(2)}
              >
                Write your own idea
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </section>
          )}

          {/* Step 2: Describe Your Scene */}
          {step === 2 && (
            <section className={styles.stepSection}>
              <div className={styles.stepHeader}>
                <button className={styles.backButton} onClick={() => setStep(1)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  Back
                </button>
                <span className={styles.stepBadge}>Step 2 of 3</span>
                <h1 className={styles.heroTitle}>
                  Describe Your Scene
                </h1>
                <p className={styles.heroSubtitle}>
                  Tell us what you envision. Be as creative as you like -
                  our AI understands cinematic language.
                </p>
              </div>

              <div className={styles.inputSection}>
                <textarea
                  className={styles.storyInput}
                  placeholder="A lone samurai stands atop a misty mountain at dawn, cherry blossoms drifting in the wind..."
                  value={storyIdea}
                  onChange={(e) => setStoryIdea(e.target.value)}
                  rows={4}
                  maxLength={500}
                />
                <div className={styles.inputMeta}>
                  <span className={styles.charCount}>{storyIdea.length}/500</span>
                  {selectedGenre && (
                    <span className={styles.genreTag}>
                      {genres.find(g => g.id === selectedGenre)?.icon} {genres.find(g => g.id === selectedGenre)?.name}
                    </span>
                  )}
                </div>
              </div>

              <button
                className={styles.generateButton}
                onClick={handleGenerate}
                disabled={!storyIdea.trim() || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <span className={styles.buttonSpinner} />
                    Creating your preview...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    Generate Preview
                  </>
                )}
              </button>

              <div className={styles.quickStarters}>
                <p className={styles.quickStartLabel}>Quick starters:</p>
                <div className={styles.quickStartTags}>
                  {genres.slice(0, 3).map((g) => (
                    <button
                      key={g.id}
                      className={styles.quickStartTag}
                      onClick={() => setStoryIdea(g.prompt)}
                    >
                      {g.icon} {g.name}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Step 3: Preview & Sign Up */}
          {step === 3 && generatedPreview && (
            <section className={styles.stepSection}>
              <div className={styles.stepHeader}>
                <button className={styles.backButton} onClick={() => setStep(2)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  Edit scene
                </button>
                <span className={styles.stepBadge}>Step 3 of 3</span>
                <h1 className={styles.heroTitle}>
                  Your Vision, Realized
                </h1>
                <p className={styles.heroSubtitle}>
                  This is just a preview of what Halcyon Cinema can create.
                  Sign up to generate full scenes, build characters, and craft entire productions.
                </p>
              </div>

              <div className={styles.previewCard}>
                <div className={styles.previewImage}>
                  <div className={styles.previewPlaceholder}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <p>Sign up to generate images</p>
                  </div>
                </div>
                <div className={styles.previewContent}>
                  <h3 className={styles.previewTitle}>{generatedPreview.title}</h3>
                  <p className={styles.previewDescription}>{generatedPreview.description}</p>
                  <div className={styles.previewMeta}>
                    <span className={styles.previewTag}>{generatedPreview.mood}</span>
                    <span className={styles.previewTag}>{generatedPreview.style}</span>
                  </div>
                </div>
              </div>

              <div className={styles.ctaSection}>
                <Link href="/auth/signup" className={styles.primaryCta}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  Create Free Account
                </Link>
                <p className={styles.ctaSubtext}>No credit card required. Start creating instantly.</p>
              </div>

              <div className={styles.featurePreview}>
                <h3 className={styles.featurePreviewTitle}>What you&apos;ll unlock:</h3>
                <div className={styles.featurePreviewGrid}>
                  {showcaseItems.map((item, index) => (
                    <div key={index} className={styles.featurePreviewItem}>
                      <span className={styles.featurePreviewIcon}>{item.icon}</span>
                      <div>
                        <h4>{item.title}</h4>
                        <p>{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>

        {/* Demo showcase at bottom */}
        {step === 1 && (
          <section className={styles.demoSection}>
            <h2 className={styles.demoTitle}>See What Creators Are Building</h2>
            <div className={styles.demoGrid}>
              {sampleScenes.map((scene, index) => (
                <div key={index} className={styles.demoCard}>
                  <div className={styles.demoCardImage}>
                    <div className={styles.demoCardPlaceholder}>
                      <span>{['🏰', '🚀', '💕'][index]}</span>
                    </div>
                  </div>
                  <div className={styles.demoCardContent}>
                    <h3>{scene.title}</h3>
                    <p>{scene.description}</p>
                    <span className={styles.demoCardMood}>{scene.mood}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerContent}>
            <p>Halcyon Cinema - The Future of Visual Storytelling</p>
            <div className={styles.footerLinks}>
              <Link href="/landing">Learn More</Link>
              <Link href="/pricing">Pricing</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

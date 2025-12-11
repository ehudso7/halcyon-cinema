import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import styles from '@/styles/Landing.module.css';

// Typing animation texts
const typingTexts = [
  'A lone samurai standing on a misty mountain peak at dawn...',
  'A cyberpunk city street with neon reflections on wet pavement...',
  'An enchanted forest with bioluminescent mushrooms...',
  'A space station orbiting a gas giant with rings...',
];

// Testimonials data
const testimonials = [
  {
    quote: "HALCYON transformed my storyboarding workflow. What used to take days now takes hours.",
    author: "Sarah Chen",
    role: "Independent Filmmaker",
    avatar: "SC",
  },
  {
    quote: "The AI understands cinematic language. I describe a scene and it captures the mood perfectly.",
    author: "Marcus Johnson",
    role: "Creative Director",
    avatar: "MJ",
  },
  {
    quote: "Finally, a tool that bridges the gap between imagination and visualization.",
    author: "Elena Rodriguez",
    role: "Screenwriter",
    avatar: "ER",
  },
];

// FAQ data
const faqs = [
  {
    question: "How does HALCYON generate images?",
    answer: "HALCYON uses state-of-the-art AI models including DALL-E 3 to transform your natural language descriptions into stunning visuals. Simply describe your scene, select a style, and watch your vision come to life.",
  },
  {
    question: "What visual styles are available?",
    answer: "We offer 12+ distinct styles including Cinematic Realism, Anime, Film Noir, Cyberpunk, Studio Ghibli-inspired, Watercolor, Comic Book, and more. Each style is optimized for cinematic storytelling.",
  },
  {
    question: "Can I export my storyboards?",
    answer: "Yes! Export your projects as professional PDF storyboards or download all assets as a ZIP file. Perfect for sharing with collaborators or presenting to clients.",
  },
  {
    question: "Is my content private?",
    answer: "Absolutely. All your projects and generated content are private by default. Only you can access your work unless you choose to share it.",
  },
  {
    question: "What are characters and lore entries?",
    answer: "Characters let you define recurring people/entities in your story with consistent visual descriptions. Lore entries help you build your world with locations, objects, and backstory that can be referenced across scenes.",
  },
];

export default function LandingPage() {
  const { data: session } = useSession();
  const [currentText, setCurrentText] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Typing animation effect
  useEffect(() => {
    const text = typingTexts[currentText];
    const speed = isDeleting ? 30 : 50;

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayedText.length < text.length) {
          setDisplayedText(text.slice(0, displayedText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        if (displayedText.length > 0) {
          setDisplayedText(text.slice(0, displayedText.length - 1));
        } else {
          setIsDeleting(false);
          setCurrentText((prev) => (prev + 1) % typingTexts.length);
        }
      }
    }, speed);

    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, currentText]);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubscribed(true);
      setEmail('');
    }
  };

  return (
    <>
      <Head>
        <title>HALCYON-Cinema | From Story to Screen — Instantly</title>
        <meta name="description" content="HALCYON is your AI-powered cinematic studio. Build entire movies, shows, and visual universes from nothing but your imagination." />
        <meta name="keywords" content="AI movie maker, storyboard app, cinematic AI, DALL-E director, film creator, GPT filmmaking, concept art, prompt-based visuals" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="HALCYON-Cinema | AI Cinematic Studio" />
        <meta property="og:description" content="Build films, series, storyboards & trailers from natural language." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
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
              <a href="#features" className={styles.navLink}>Features</a>
              <a href="#how-it-works" className={styles.navLink}>How it Works</a>
              <a href="#pricing" className={styles.navLink}>Pricing</a>
              <a href="#faq" className={styles.navLink}>FAQ</a>
              {session ? (
                <Link href="/" className={styles.navCta}>Dashboard</Link>
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
            <div className={styles.badge}>
              <span className={styles.badgeDot} />
              Now with DALL-E 3 Integration
            </div>
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
                    Start Creating Free
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
                <span className={styles.previewTitle}>Scene Generator</span>
              </div>
              <div className={styles.previewContent}>
                <div className={styles.previewPrompt}>
                  <span className={styles.promptLabel}>Your prompt:</span>
                  <span className={styles.typingText}>
                    &ldquo;{displayedText}&rdquo;
                    <span className={styles.cursor}>|</span>
                  </span>
                </div>
                <div className={styles.previewImage}>
                  <div className={styles.previewGlow} />
                  <span className={styles.previewIcon}>🎨</span>
                  <span>AI-Generated Scene</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Social Proof */}
        <section className={styles.socialProof}>
          <div className={styles.socialProofContent}>
            <div className={styles.stat}>
              <span className={styles.statNumber}>10K+</span>
              <span className={styles.statLabel}>Scenes Generated</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNumber}>2K+</span>
              <span className={styles.statLabel}>Creators</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNumber}>12+</span>
              <span className={styles.statLabel}>Visual Styles</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNumber}>4.9</span>
              <span className={styles.statLabel}>User Rating</span>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className={styles.features}>
          <h2 className={styles.sectionTitle}>Create Cinematic Magic</h2>
          <p className={styles.sectionSubtitle}>Everything you need to bring your stories to life</p>
          <div className={styles.featureGrid}>
            <div className={styles.feature}>
              <div className={styles.featureIconWrapper}>
                <span className={styles.featureIcon}>📝</span>
              </div>
              <h3>Natural Language Prompts</h3>
              <p>Describe your scene in plain English. Our AI transforms your words into stunning visuals.</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIconWrapper}>
                <span className={styles.featureIcon}>🎨</span>
              </div>
              <h3>12+ Visual Styles</h3>
              <p>From Ghibli-inspired to Cyberpunk, Film Noir to Anime — choose your aesthetic.</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIconWrapper}>
                <span className={styles.featureIcon}>🤖</span>
              </div>
              <h3>AI Creative Assistant</h3>
              <p>Get real-time suggestions for lighting, mood, composition, and story elements.</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIconWrapper}>
                <span className={styles.featureIcon}>👥</span>
              </div>
              <h3>Character Tracking</h3>
              <p>Create characters and track their appearances across your entire project.</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIconWrapper}>
                <span className={styles.featureIcon}>🎬</span>
              </div>
              <h3>Sequence Mode</h3>
              <p>Arrange scenes into sequences and watch them flow like a cinematic trailer.</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIconWrapper}>
                <span className={styles.featureIcon}>📄</span>
              </div>
              <h3>Export Anywhere</h3>
              <p>Download as PDF storyboards or ZIP archives with all your images and prompts.</p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className={styles.howItWorks}>
          <h2 className={styles.sectionTitle}>How It Works</h2>
          <p className={styles.sectionSubtitle}>Four simple steps to cinematic visualization</p>
          <div className={styles.stepsGrid}>
            <div className={styles.step}>
              <div className={styles.stepNumber}>1</div>
              <div className={styles.stepContent}>
                <h3>Create a Project</h3>
                <p>Start with a new project to organize your scenes, characters, and world-building elements.</p>
              </div>
            </div>
            <div className={styles.stepConnector}>
              <svg viewBox="0 0 100 20" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4">
                <path d="M0 10 H100" />
              </svg>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNumber}>2</div>
              <div className={styles.stepContent}>
                <h3>Describe Your Vision</h3>
                <p>Write natural language descriptions of your scenes. Add mood, lighting, and style preferences.</p>
              </div>
            </div>
            <div className={styles.stepConnector}>
              <svg viewBox="0 0 100 20" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4">
                <path d="M0 10 H100" />
              </svg>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNumber}>3</div>
              <div className={styles.stepContent}>
                <h3>Generate & Refine</h3>
                <p>AI creates your scene instantly. Refine with variations, adjust parameters, or regenerate.</p>
              </div>
            </div>
            <div className={styles.stepConnector}>
              <svg viewBox="0 0 100 20" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4">
                <path d="M0 10 H100" />
              </svg>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNumber}>4</div>
              <div className={styles.stepContent}>
                <h3>Export & Share</h3>
                <p>Download professional storyboards as PDF or export all assets for your production team.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className={styles.testimonials}>
          <h2 className={styles.sectionTitle}>Loved by Creators</h2>
          <div className={styles.testimonialCarousel}>
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className={`${styles.testimonialCard} ${index === activeTestimonial ? styles.active : ''}`}
              >
                <p className={styles.testimonialQuote}>&ldquo;{testimonial.quote}&rdquo;</p>
                <div className={styles.testimonialAuthor}>
                  <div className={styles.testimonialAvatar}>{testimonial.avatar}</div>
                  <div>
                    <div className={styles.testimonialName}>{testimonial.author}</div>
                    <div className={styles.testimonialRole}>{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
            <div className={styles.testimonialDots}>
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  className={`${styles.testimonialDot} ${index === activeTestimonial ? styles.active : ''}`}
                  onClick={() => setActiveTestimonial(index)}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className={styles.pricing}>
          <h2 className={styles.sectionTitle}>Simple, Transparent Pricing</h2>
          <p className={styles.sectionSubtitle}>Start free, upgrade when you need more</p>
          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <div className={styles.pricingHeader}>
                <h3>Free</h3>
                <div className={styles.pricingPrice}>
                  <span className={styles.pricingAmount}>$0</span>
                  <span className={styles.pricingPeriod}>/month</span>
                </div>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  5 projects
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  50 scene generations/month
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  All visual styles
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  PDF export
                </li>
              </ul>
              <Link href="/auth/signup" className={styles.pricingBtn}>
                Get Started
              </Link>
            </div>
            <div className={`${styles.pricingCard} ${styles.featured}`}>
              <div className={styles.pricingBadge}>Most Popular</div>
              <div className={styles.pricingHeader}>
                <h3>Pro</h3>
                <div className={styles.pricingPrice}>
                  <span className={styles.pricingAmount}>$19</span>
                  <span className={styles.pricingPeriod}>/month</span>
                </div>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Unlimited projects
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  500 scene generations/month
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Priority generation queue
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  HD image exports
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Custom watermarks
                </li>
              </ul>
              <Link href="/auth/signup" className={`${styles.pricingBtn} ${styles.primary}`}>
                Start Pro Trial
              </Link>
            </div>
            <div className={styles.pricingCard}>
              <div className={styles.pricingHeader}>
                <h3>Studio</h3>
                <div className={styles.pricingPrice}>
                  <span className={styles.pricingAmount}>$49</span>
                  <span className={styles.pricingPeriod}>/month</span>
                </div>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Everything in Pro
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Unlimited generations
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Team collaboration
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  API access
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Priority support
                </li>
              </ul>
              <Link href="/auth/signup" className={styles.pricingBtn}>
                Contact Sales
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className={styles.faq}>
          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <div className={styles.faqList}>
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`${styles.faqItem} ${openFaq === index ? styles.open : ''}`}
              >
                <button
                  className={styles.faqQuestion}
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  aria-expanded={openFaq === index}
                >
                  <span>{faq.question}</span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={styles.faqIcon}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <div className={styles.faqAnswer}>
                  <p>{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Newsletter Section */}
        <section className={styles.newsletter}>
          <div className={styles.newsletterContent}>
            <h2>Stay in the Loop</h2>
            <p>Get updates on new features, tips, and cinematic inspiration.</p>
            {isSubscribed ? (
              <div className={styles.newsletterSuccess}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Thanks for subscribing!</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className={styles.newsletterForm}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.newsletterInput}
                  required
                />
                <button type="submit" className={styles.newsletterBtn}>
                  Subscribe
                </button>
              </form>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className={styles.cta}>
          <h2>See Your Story Come to Life</h2>
          <p>Join thousands of creators using HALCYON to visualize their cinematic visions.</p>
          <Link href="/auth/signup" className={styles.btnPrimary}>
            Build Your First Scene — Free
          </Link>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerContent}>
            <div className={styles.footerTop}>
              <div className={styles.footerBrand}>
                <span className={styles.logoIcon}>🎬</span>
                <span>HALCYON-Cinema</span>
              </div>
              <div className={styles.footerLinks}>
                <div className={styles.footerColumn}>
                  <h4>Product</h4>
                  <a href="#features">Features</a>
                  <a href="#pricing">Pricing</a>
                  <a href="#faq">FAQ</a>
                </div>
                <div className={styles.footerColumn}>
                  <h4>Legal</h4>
                  <Link href="/terms">Terms of Service</Link>
                  <Link href="/privacy">Privacy Policy</Link>
                </div>
                <div className={styles.footerColumn}>
                  <h4>Connect</h4>
                  <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">Twitter</a>
                  <a href="https://discord.com" target="_blank" rel="noopener noreferrer">Discord</a>
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
                </div>
              </div>
            </div>
            <div className={styles.footerBottom}>
              <p className={styles.footerText}>
                Powered by GPT-4, DALL-E 3, and Next.js
              </p>
              <p className={styles.footerCopy}>
                © {new Date().getFullYear()} HALCYON-Cinema. Built by creators, for creators.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

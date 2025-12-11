import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/Header';
import styles from '@/styles/Legal.module.css';

const sections = [
  { id: 'acceptance', title: '1. Acceptance of Terms' },
  { id: 'description', title: '2. Description of Service' },
  { id: 'ai-disclosure', title: '3. AI-Generated Content Disclosure' },
  { id: 'accounts', title: '4. User Accounts' },
  { id: 'acceptable-use', title: '5. Acceptable Use' },
  { id: 'ownership', title: '6. Content Ownership and Rights' },
  { id: 'usage-limits', title: '7. Usage Limits and Credits' },
  { id: 'ip', title: '8. Intellectual Property' },
  { id: 'warranties', title: '9. Disclaimer of Warranties' },
  { id: 'liability', title: '10. Limitation of Liability' },
  { id: 'termination', title: '11. Termination' },
  { id: 'changes', title: '12. Changes to Terms' },
  { id: 'contact', title: '13. Contact' },
];

export default function TermsOfService() {
  const lastUpdated = 'December 10, 2025';
  const [activeSection, setActiveSection] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);

      // Update active section based on scroll position
      const sectionElements = sections.map(s => ({
        id: s.id,
        element: document.getElementById(s.id),
      }));

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const { id, element } = sectionElements[i];
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 150) {
            setActiveSection(id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    setShowToc(false);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <Head>
        <title>Terms of Service | HALCYON-Cinema</title>
        <meta name="description" content="Terms of Service for HALCYON-Cinema AI-powered cinematic content studio" />
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <div className={styles.legalLayout}>
            {/* Table of Contents - Sidebar */}
            <aside className={`${styles.toc} ${showToc ? styles.tocOpen : ''}`}>
              <div className={styles.tocHeader}>
                <h2>Contents</h2>
                <button
                  className={styles.tocClose}
                  onClick={() => setShowToc(false)}
                  aria-label="Close table of contents"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <nav>
                <ul className={styles.tocList}>
                  {sections.map(section => (
                    <li key={section.id}>
                      <button
                        onClick={() => scrollToSection(section.id)}
                        className={`${styles.tocLink} ${activeSection === section.id ? styles.active : ''}`}
                      >
                        {section.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            {/* Mobile TOC Toggle */}
            <button
              className={styles.tocToggle}
              onClick={() => setShowToc(true)}
              aria-label="Open table of contents"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              Contents
            </button>

            {/* Main Content */}
            <article className={styles.legal} ref={contentRef}>
              <header className={styles.header}>
                <div className={styles.headerBadge}>Legal</div>
                <h1 className={styles.title}>Terms of Service</h1>
                <p className={styles.updated}>Last updated: {lastUpdated}</p>
              </header>

              <section id="acceptance" className={styles.section}>
                <h2>1. Acceptance of Terms</h2>
                <p>
                  By accessing or using HALCYON-Cinema (&ldquo;Service&rdquo;), you agree to be bound by these
                  Terms of Service. If you do not agree to these terms, please do not use our Service.
                </p>
              </section>

              <section id="description" className={styles.section}>
                <h2>2. Description of Service</h2>
                <p>
                  HALCYON-Cinema is an AI-powered cinematic content studio that enables users to create
                  scenes, storyboards, and visual content using artificial intelligence technology,
                  specifically OpenAI&apos;s DALL-E 3 image generation model.
                </p>
              </section>

              <section id="ai-disclosure" className={styles.section}>
                <h2>3. AI-Generated Content Disclosure</h2>
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div>
                    <p>
                      <strong>Important:</strong> All images and visual content created through HALCYON-Cinema
                      are generated by artificial intelligence (AI). This content:
                    </p>
                    <ul>
                      <li>Is created using OpenAI&apos;s DALL-E 3 image generation technology</li>
                      <li>May not accurately represent real people, places, or events</li>
                      <li>Should be clearly labeled as AI-generated when shared publicly</li>
                      <li>Must not be used to create deceptive or misleading content</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section id="accounts" className={styles.section}>
                <h2>4. User Accounts</h2>
                <p>
                  To use certain features of the Service, you must create an account. You are responsible for:
                </p>
                <ul>
                  <li>Maintaining the confidentiality of your account credentials</li>
                  <li>All activities that occur under your account</li>
                  <li>Notifying us immediately of any unauthorized use</li>
                </ul>
              </section>

              <section id="acceptable-use" className={styles.section}>
                <h2>5. Acceptable Use</h2>
                <p>You agree NOT to use the Service to:</p>
                <ul>
                  <li>Generate content depicting real individuals without their consent</li>
                  <li>Create harmful, abusive, or illegal content</li>
                  <li>Generate content that infringes on intellectual property rights</li>
                  <li>Create deepfakes or deceptive media intended to mislead</li>
                  <li>Produce content depicting minors in any inappropriate context</li>
                  <li>Generate violent, hateful, or discriminatory content</li>
                  <li>Violate any applicable laws or regulations</li>
                </ul>
              </section>

              <section id="ownership" className={styles.section}>
                <h2>6. Content Ownership and Rights</h2>
                <p>Subject to compliance with these Terms:</p>
                <ul>
                  <li>You retain ownership of the text prompts you submit to the Service</li>
                  <li>AI-generated images are provided for your use in accordance with OpenAI&apos;s usage policies</li>
                  <li>You may use generated content for personal and commercial purposes, subject to applicable laws and these Terms</li>
                  <li>We do not claim ownership of content you create using the Service</li>
                </ul>
              </section>

              <section id="usage-limits" className={styles.section}>
                <h2>7. Usage Limits and Credits</h2>
                <p>
                  The Service operates on a credit-based system. Free accounts receive a limited number
                  of credits. Usage limits may apply, and we reserve the right to modify these limits
                  at any time.
                </p>
              </section>

              <section id="ip" className={styles.section}>
                <h2>8. Intellectual Property</h2>
                <p>
                  The HALCYON-Cinema brand, logo, software, and associated materials are protected by
                  intellectual property laws. You may not copy, modify, or distribute our proprietary
                  materials without express permission.
                </p>
              </section>

              <section id="warranties" className={styles.section}>
                <h2>9. Disclaimer of Warranties</h2>
                <div className={styles.legalNotice}>
                  <p>
                    THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE
                    THAT AI-GENERATED CONTENT WILL MEET YOUR SPECIFIC REQUIREMENTS OR EXPECTATIONS.
                    RESULTS MAY VARY.
                  </p>
                </div>
              </section>

              <section id="liability" className={styles.section}>
                <h2>10. Limitation of Liability</h2>
                <div className={styles.legalNotice}>
                  <p>
                    TO THE MAXIMUM EXTENT PERMITTED BY LAW, HALCYON-CINEMA SHALL NOT BE LIABLE FOR ANY
                    INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR
                    USE OF THE SERVICE.
                  </p>
                </div>
              </section>

              <section id="termination" className={styles.section}>
                <h2>11. Termination</h2>
                <p>
                  We reserve the right to suspend or terminate your account at any time for violations
                  of these Terms or for any other reason at our sole discretion.
                </p>
              </section>

              <section id="changes" className={styles.section}>
                <h2>12. Changes to Terms</h2>
                <p>
                  We may update these Terms from time to time. We will notify users of significant
                  changes. Continued use of the Service after changes constitutes acceptance of the
                  new Terms.
                </p>
              </section>

              <section id="contact" className={styles.section}>
                <h2>13. Contact</h2>
                <p>
                  For questions about these Terms, please contact us at{' '}
                  <a href="mailto:legal@halcyon-cinema.com">legal@halcyon-cinema.com</a>
                </p>
              </section>

              <div className={styles.footer}>
                <Link href="/privacy" className={styles.link}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  Privacy Policy
                </Link>
                <span className={styles.separator}>|</span>
                <Link href="/" className={styles.link}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  Return to Home
                </Link>
              </div>
            </article>
          </div>

          {/* Back to Top Button */}
          {showBackToTop && (
            <button
              className={styles.backToTop}
              onClick={scrollToTop}
              aria-label="Back to top"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          )}
        </div>
      </main>
    </>
  );
}

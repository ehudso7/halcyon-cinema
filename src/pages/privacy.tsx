import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/Header';
import styles from '@/styles/Legal.module.css';

const sections = [
  { id: 'introduction', title: '1. Introduction' },
  { id: 'information', title: '2. Information We Collect' },
  { id: 'how-we-use', title: '3. How We Use Your Information' },
  { id: 'ai-processing', title: '4. AI Processing and Third Parties' },
  { id: 'storage', title: '5. Data Storage and Security' },
  { id: 'retention', title: '6. Data Retention' },
  { id: 'rights', title: '7. Your Rights' },
  { id: 'cookies', title: '8. Cookies and Tracking' },
  { id: 'children', title: '9. Children\'s Privacy' },
  { id: 'international', title: '10. International Data Transfers' },
  { id: 'changes', title: '11. Changes to This Policy' },
  { id: 'contact', title: '12. Contact Us' },
];

export default function PrivacyPolicy() {
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
        <title>Privacy Policy | HALCYON-Cinema</title>
        <meta name="description" content="Privacy Policy for HALCYON-Cinema AI-powered cinematic content studio" />
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
                <h1 className={styles.title}>Privacy Policy</h1>
                <p className={styles.updated}>Last updated: {lastUpdated}</p>
              </header>

              <section id="introduction" className={styles.section}>
                <h2>1. Introduction</h2>
                <p>
                  HALCYON-Cinema (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) respects your privacy and is committed
                  to protecting your personal data. This Privacy Policy explains how we collect, use,
                  and safeguard your information when you use our AI-powered cinematic content studio.
                </p>
              </section>

              <section id="information" className={styles.section}>
                <h2>2. Information We Collect</h2>

                <h3>2.1 Account Information</h3>
                <p>When you create an account, we collect:</p>
                <ul>
                  <li>Email address</li>
                  <li>Name (optional)</li>
                  <li>Password (encrypted)</li>
                </ul>

                <h3>2.2 Usage Data</h3>
                <p>We automatically collect:</p>
                <ul>
                  <li>Generation history and statistics (stored locally in your browser)</li>
                  <li>Feature usage patterns</li>
                  <li>Device and browser information</li>
                  <li>IP address and general location</li>
                </ul>

                <h3>2.3 Content Data</h3>
                <p>When you use our Service, we process:</p>
                <ul>
                  <li>Text prompts you submit for AI image generation</li>
                  <li>Generated images and their metadata</li>
                  <li>Project names and descriptions</li>
                </ul>
              </section>

              <section id="how-we-use" className={styles.section}>
                <h2>3. How We Use Your Information</h2>
                <p>We use your information to:</p>
                <ul>
                  <li>Provide and improve our AI image generation service</li>
                  <li>Process your requests and generate content</li>
                  <li>Manage your account and preferences</li>
                  <li>Send important service updates</li>
                  <li>Analyze usage patterns to improve user experience</li>
                  <li>Ensure compliance with our Terms of Service</li>
                  <li>Prevent abuse and maintain security</li>
                </ul>
              </section>

              <section id="ai-processing" className={styles.section}>
                <h2>4. AI Processing and Third Parties</h2>
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
                      <strong>Important:</strong> Your text prompts are processed by OpenAI&apos;s DALL-E 3
                      service to generate images. This means:
                    </p>
                    <ul>
                      <li>Your prompts are transmitted to OpenAI&apos;s servers</li>
                      <li>OpenAI may retain prompt data according to their privacy policy</li>
                      <li>Generated images may be stored on cloud infrastructure</li>
                    </ul>
                    <p>
                      We encourage you to review{' '}
                      <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer">
                        OpenAI&apos;s Privacy Policy
                      </a>{' '}
                      for more information.
                    </p>
                  </div>
                </div>
              </section>

              <section id="storage" className={styles.section}>
                <h2>5. Data Storage and Security</h2>
                <p>We implement industry-standard security measures including:</p>
                <ul>
                  <li>Encryption of sensitive data in transit and at rest</li>
                  <li>Secure password hashing using bcrypt</li>
                  <li>Regular security audits and updates</li>
                  <li>Access controls and monitoring</li>
                </ul>
                <p>
                  Usage statistics and achievements are stored locally in your browser using
                  localStorage and are not transmitted to our servers.
                </p>
              </section>

              <section id="retention" className={styles.section}>
                <h2>6. Data Retention</h2>
                <p>We retain your data as follows:</p>
                <div className={styles.dataGrid}>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>Account data</span>
                    <span className={styles.dataValue}>Until you delete your account</span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>Generated content</span>
                    <span className={styles.dataValue}>Until you delete it or your account</span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>Usage logs</span>
                    <span className={styles.dataValue}>Up to 90 days</span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>Local storage data</span>
                    <span className={styles.dataValue}>Until you clear your browser data</span>
                  </div>
                </div>
              </section>

              <section id="rights" className={styles.section}>
                <h2>7. Your Rights</h2>
                <p>Depending on your location, you may have the right to:</p>
                <ul>
                  <li>Access your personal data</li>
                  <li>Correct inaccurate data</li>
                  <li>Delete your data (&ldquo;right to be forgotten&rdquo;)</li>
                  <li>Export your data in a portable format</li>
                  <li>Restrict or object to certain processing</li>
                  <li>Withdraw consent at any time</li>
                </ul>
                <p>
                  To exercise these rights, please contact us at{' '}
                  <a href="mailto:privacy@halcyon-cinema.com">privacy@halcyon-cinema.com</a>
                </p>
              </section>

              <section id="cookies" className={styles.section}>
                <h2>8. Cookies and Tracking</h2>
                <p>We use the following technologies:</p>
                <div className={styles.dataGrid}>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>Essential cookies</span>
                    <span className={styles.dataValue}>Required for authentication and security</span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>localStorage</span>
                    <span className={styles.dataValue}>To store your preferences and usage statistics locally</span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>Session storage</span>
                    <span className={styles.dataValue}>For temporary data during your session</span>
                  </div>
                </div>
                <p className={styles.noteText}>
                  We do not use third-party tracking cookies or sell your data to advertisers.
                </p>
              </section>

              <section id="children" className={styles.section}>
                <h2>9. Children&apos;s Privacy</h2>
                <p>
                  Our Service is not intended for users under 13 years of age. We do not knowingly
                  collect personal information from children. If you believe we have collected data
                  from a child, please contact us immediately.
                </p>
              </section>

              <section id="international" className={styles.section}>
                <h2>10. International Data Transfers</h2>
                <p>
                  Your data may be processed in countries other than your own. We ensure appropriate
                  safeguards are in place for any international data transfers.
                </p>
              </section>

              <section id="changes" className={styles.section}>
                <h2>11. Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy periodically. We will notify you of significant
                  changes via email or through the Service. The &ldquo;Last updated&rdquo; date at the top
                  indicates when changes were last made.
                </p>
              </section>

              <section id="contact" className={styles.section}>
                <h2>12. Contact Us</h2>
                <p>For privacy-related questions or concerns, please contact:</p>
                <div className={styles.contactBox}>
                  <p>
                    <strong>Email:</strong>{' '}
                    <a href="mailto:privacy@halcyon-cinema.com">privacy@halcyon-cinema.com</a>
                  </p>
                  <p>
                    <strong>Subject:</strong> Privacy Inquiry
                  </p>
                </div>
              </section>

              <div className={styles.footer}>
                <Link href="/terms" className={styles.link}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Terms of Service
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

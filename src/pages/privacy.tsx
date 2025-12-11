import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/Header';
import styles from '@/styles/Legal.module.css';

export default function PrivacyPolicy() {
  const lastUpdated = 'December 10, 2025';

  return (
    <>
      <Head>
        <title>Privacy Policy | HALCYON-Cinema</title>
        <meta name="description" content="Privacy Policy for HALCYON-Cinema AI-powered cinematic content studio" />
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <article className={styles.legal}>
            <header className={styles.header}>
              <h1 className={styles.title}>Privacy Policy</h1>
              <p className={styles.updated}>Last updated: {lastUpdated}</p>
            </header>

            <section className={styles.section}>
              <h2>1. Introduction</h2>
              <p>
                HALCYON-Cinema (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) respects your privacy and is committed
                to protecting your personal data. This Privacy Policy explains how we collect, use,
                and safeguard your information when you use our AI-powered cinematic content studio.
              </p>
            </section>

            <section className={styles.section}>
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

            <section className={styles.section}>
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

            <section className={styles.section}>
              <h2>4. AI Processing and Third Parties</h2>
              <div className={styles.highlight}>
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
            </section>

            <section className={styles.section}>
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

            <section className={styles.section}>
              <h2>6. Data Retention</h2>
              <p>We retain your data as follows:</p>
              <ul>
                <li><strong>Account data:</strong> Until you delete your account</li>
                <li><strong>Generated content:</strong> Until you delete it or your account</li>
                <li><strong>Usage logs:</strong> Up to 90 days</li>
                <li><strong>Local storage data:</strong> Until you clear your browser data</li>
              </ul>
            </section>

            <section className={styles.section}>
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
                To exercise these rights, please contact us at privacy@halcyon-cinema.com
              </p>
            </section>

            <section className={styles.section}>
              <h2>8. Cookies and Tracking</h2>
              <p>We use the following technologies:</p>
              <ul>
                <li>
                  <strong>Essential cookies:</strong> Required for authentication and security
                </li>
                <li>
                  <strong>localStorage:</strong> To store your preferences and usage statistics locally
                </li>
                <li>
                  <strong>Session storage:</strong> For temporary data during your session
                </li>
              </ul>
              <p>
                We do not use third-party tracking cookies or sell your data to advertisers.
              </p>
            </section>

            <section className={styles.section}>
              <h2>9. Children&apos;s Privacy</h2>
              <p>
                Our Service is not intended for users under 13 years of age. We do not knowingly
                collect personal information from children. If you believe we have collected data
                from a child, please contact us immediately.
              </p>
            </section>

            <section className={styles.section}>
              <h2>10. International Data Transfers</h2>
              <p>
                Your data may be processed in countries other than your own. We ensure appropriate
                safeguards are in place for any international data transfers.
              </p>
            </section>

            <section className={styles.section}>
              <h2>11. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy periodically. We will notify you of significant
                changes via email or through the Service. The &ldquo;Last updated&rdquo; date at the top
                indicates when changes were last made.
              </p>
            </section>

            <section className={styles.section}>
              <h2>12. Contact Us</h2>
              <p>
                For privacy-related questions or concerns, please contact:
              </p>
              <p>
                <strong>Email:</strong> privacy@halcyon-cinema.com<br />
                <strong>Subject:</strong> Privacy Inquiry
              </p>
            </section>

            <div className={styles.footer}>
              <Link href="/terms" className={styles.link}>
                Terms of Service
              </Link>
              <span className={styles.separator}>|</span>
              <Link href="/" className={styles.link}>
                Return to Home
              </Link>
            </div>
          </article>
        </div>
      </main>
    </>
  );
}

import { useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import styles from '@/styles/Pricing.module.css';

interface PricingPageProps {
  isLoggedIn: boolean;
  currentTier?: string;
  creditsRemaining?: number;
}

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  priceId: string;
  credits: number;
  features: string[];
  popular?: boolean;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 9,
    priceId: 'price_starter',
    credits: 100,
    features: [
      '100 generation credits',
      'Image generation (DALL-E 3)',
      'All visual styles',
      'Project management',
      'Scene organization',
      'Export to PDF/ZIP',
    ],
  },
  {
    id: 'creator',
    name: 'Creator',
    price: 29,
    priceId: 'price_creator',
    credits: 500,
    features: [
      '500 generation credits',
      'Everything in Starter',
      'Video generation',
      'Music generation',
      'Voiceover generation',
      'Priority support',
      'Advanced AI controls',
    ],
    popular: true,
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 99,
    priceId: 'price_studio',
    credits: 2000,
    features: [
      '2,000 generation credits',
      'Everything in Creator',
      'Unlimited projects',
      'Team collaboration (coming soon)',
      'API access (coming soon)',
      'Custom style training (coming soon)',
      'Dedicated support',
    ],
  },
];

const CREDIT_PACKS = [
  { credits: 50, price: 5, priceId: 'price_50_credits' },
  { credits: 100, price: 9, priceId: 'price_100_credits' },
  { credits: 250, price: 19, priceId: 'price_250_credits' },
  { credits: 500, price: 35, priceId: 'price_500_credits' },
  { credits: 1000, price: 65, priceId: 'price_1000_credits' },
];

export default function PricingPage({ isLoggedIn, currentTier, creditsRemaining }: PricingPageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreditPacks, setShowCreditPacks] = useState(false);

  const handleSubscribe = async (plan: PricingPlan) => {
    if (!isLoggedIn) {
      router.push('/auth/signin?callbackUrl=/pricing');
      return;
    }

    setIsLoading(plan.id);
    setError(null);

    try {
      const response = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.priceId,
          mode: 'subscription',
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(null);
    }
  };

  const handleBuyCredits = async (pack: typeof CREDIT_PACKS[0]) => {
    if (!isLoggedIn) {
      router.push('/auth/signin?callbackUrl=/pricing');
      return;
    }

    setIsLoading(`credits-${pack.credits}`);
    setError(null);

    try {
      const response = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: pack.priceId,
          mode: 'payment',
          credits: pack.credits,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <>
      <Head>
        <title>Pricing | HALCYON-Cinema</title>
        <meta name="description" content="Choose a plan that works for you. Generate stunning AI visuals for your creative projects." />
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <div className={styles.header}>
            <h1 className={styles.title}>Simple, transparent pricing</h1>
            <p className={styles.subtitle}>
              Choose a plan that works for you. All plans include access to our powerful AI generation tools.
            </p>

            {isLoggedIn && creditsRemaining !== undefined && (
              <div className={styles.currentCredits}>
                You have <strong>{creditsRemaining}</strong> credits remaining
                {currentTier && currentTier !== 'free' && (
                  <span className={styles.tierBadge}>{currentTier}</span>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className={styles.error}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          {/* Subscription Plans */}
          <div className={styles.plans}>
            {PRICING_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`${styles.plan} ${plan.popular ? styles.popular : ''}`}
              >
                {plan.popular && <span className={styles.badge}>Most Popular</span>}
                <h2 className={styles.planName}>{plan.name}</h2>
                <div className={styles.price}>
                  <span className={styles.currency}>$</span>
                  <span className={styles.amount}>{plan.price}</span>
                  <span className={styles.period}>/month</span>
                </div>
                <p className={styles.credits}>
                  <strong>{plan.credits}</strong> credits/month
                </p>

                <ul className={styles.features}>
                  {plan.features.map((feature, index) => (
                    <li key={index}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  className={`btn ${plan.popular ? 'btn-primary' : 'btn-secondary'} btn-full`}
                  onClick={() => handleSubscribe(plan)}
                  disabled={isLoading === plan.id}
                >
                  {isLoading === plan.id ? (
                    <>
                      <span className={styles.spinner} />
                      Processing...
                    </>
                  ) : currentTier === plan.id ? (
                    'Current Plan'
                  ) : (
                    'Get Started'
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Credit Packs */}
          <div className={styles.creditSection}>
            <button
              className={styles.creditToggle}
              onClick={() => setShowCreditPacks(!showCreditPacks)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v12M6 12h12" />
              </svg>
              Need more credits? Buy credit packs
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={showCreditPacks ? styles.rotated : ''}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showCreditPacks && (
              <div className={styles.creditPacks}>
                {CREDIT_PACKS.map((pack) => (
                  <div key={pack.credits} className={styles.creditPack}>
                    <div className={styles.packInfo}>
                      <span className={styles.packCredits}>{pack.credits} credits</span>
                      <span className={styles.packPrice}>${pack.price}</span>
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleBuyCredits(pack)}
                      disabled={isLoading === `credits-${pack.credits}`}
                    >
                      {isLoading === `credits-${pack.credits}` ? (
                        <span className={styles.spinner} />
                      ) : (
                        'Buy'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Credit Usage */}
          <div className={styles.creditInfo}>
            <h3>Credit Usage</h3>
            <div className={styles.creditTable}>
              <div className={styles.creditRow}>
                <span>Image Generation (DALL-E 3)</span>
                <span className={styles.creditCost}>1 credit</span>
              </div>
              <div className={styles.creditRow}>
                <span>Voiceover Generation</span>
                <span className={styles.creditCost}>2 credits</span>
              </div>
              <div className={styles.creditRow}>
                <span>Music Generation</span>
                <span className={styles.creditCost}>5 credits</span>
              </div>
              <div className={styles.creditRow}>
                <span>Video Generation</span>
                <span className={styles.creditCost}>10 credits</span>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className={styles.faq}>
            <h3>Frequently Asked Questions</h3>
            <div className={styles.faqItem}>
              <h4>What happens to unused credits?</h4>
              <p>Unused subscription credits roll over to the next month, up to 2x your monthly allowance. One-time credit purchases never expire.</p>
            </div>
            <div className={styles.faqItem}>
              <h4>Can I cancel my subscription?</h4>
              <p>Yes, you can cancel anytime. You&apos;ll retain access to your credits until the end of your billing period.</p>
            </div>
            <div className={styles.faqItem}>
              <h4>Do my generated images have commercial rights?</h4>
              <p>Yes! All images you generate are yours to use commercially, subject to OpenAI&apos;s usage policies.</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<PricingPageProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session?.user?.id) {
    return {
      props: {
        isLoggedIn: false,
      },
    };
  }

  // Fetch user credits
  try {
    const { getUserCredits } = await import('@/utils/db');
    const credits = await getUserCredits(session.user.id);

    return {
      props: {
        isLoggedIn: true,
        currentTier: credits?.subscriptionTier || 'free',
        creditsRemaining: credits?.creditsRemaining || 0,
      },
    };
  } catch {
    return {
      props: {
        isLoggedIn: true,
        creditsRemaining: 0,
      },
    };
  }
};

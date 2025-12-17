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
  stripeConfigured: boolean;
  priceIds: {
    starterMonthly: string;
    starterYearly: string;
    creatorMonthly: string;
    creatorYearly: string;
    studioMonthly: string;
    studioYearly: string;
    credits50: string;
    credits100: string;
    credits250: string;
    credits500: string;
    credits1000: string;
  };
}

interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyPriceId: string;
  yearlyPriceId: string;
  credits: number;
  features: string[];
  popular?: boolean;
}

interface CreditPack {
  credits: number;
  price: number;
  priceId: string;
}

export default function PricingPage({ isLoggedIn, currentTier, creditsRemaining, stripeConfigured, priceIds }: PricingPageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreditPacks, setShowCreditPacks] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  // Sweet-spot pricing with clear value progression
  const plans: PricingPlan[] = [
    {
      id: 'starter',
      name: 'Starter',
      monthlyPrice: 12,
      yearlyPrice: 120,
      monthlyPriceId: priceIds.starterMonthly,
      yearlyPriceId: priceIds.starterYearly,
      credits: 100,
      features: [
        '100 generation credits/month',
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
      monthlyPrice: 29,
      yearlyPrice: 290,
      monthlyPriceId: priceIds.creatorMonthly,
      yearlyPriceId: priceIds.creatorYearly,
      credits: 500,
      features: [
        '500 generation credits/month',
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
      monthlyPrice: 79,
      yearlyPrice: 790,
      monthlyPriceId: priceIds.studioMonthly,
      yearlyPriceId: priceIds.studioYearly,
      credits: 2000,
      features: [
        '2,000 generation credits/month',
        'Everything in Creator',
        'Unlimited projects',
        'Team collaboration (coming soon)',
        'API access (coming soon)',
        'Custom style training (coming soon)',
        'Dedicated support',
      ],
    },
  ];

  // Credit packs with volume discounts
  const creditPacks: CreditPack[] = [
    { credits: 50, price: 5, priceId: priceIds.credits50 },
    { credits: 100, price: 9, priceId: priceIds.credits100 },
    { credits: 250, price: 20, priceId: priceIds.credits250 },
    { credits: 500, price: 35, priceId: priceIds.credits500 },
    { credits: 1000, price: 60, priceId: priceIds.credits1000 },
  ];

  const handleSubscribe = async (plan: PricingPlan) => {
    if (!isLoggedIn) {
      router.push('/auth/signin?callbackUrl=/pricing');
      return;
    }

    setIsLoading(plan.id);
    setError(null);

    const priceId = billingPeriod === 'yearly' ? plan.yearlyPriceId : plan.monthlyPriceId;

    try {
      const response = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
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

  const handleBuyCredits = async (pack: CreditPack) => {
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
                {currentTier && currentTier !== 'starter' && (
                  <span className={styles.tierBadge}>{currentTier}</span>
                )}
              </div>
            )}
          </div>

          {!stripeConfigured && (
            <div className={styles.error}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Payment processing is being set up. Please check back soon.
            </div>
          )}

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

          {/* Billing Toggle */}
          <div className={styles.billingToggle}>
            <button
              className={`${styles.toggleBtn} ${billingPeriod === 'monthly' ? styles.active : ''}`}
              onClick={() => setBillingPeriod('monthly')}
            >
              Monthly
            </button>
            <button
              className={`${styles.toggleBtn} ${billingPeriod === 'yearly' ? styles.active : ''}`}
              onClick={() => setBillingPeriod('yearly')}
            >
              Yearly
              <span className={styles.saveBadge}>Save 17%</span>
            </button>
          </div>

          {/* Subscription Plans */}
          <div className={styles.plans}>
            {plans.map((plan) => {
              const displayPrice = billingPeriod === 'yearly'
                ? Math.round(plan.yearlyPrice / 12)
                : plan.monthlyPrice;
              const totalYearlyPrice = plan.yearlyPrice;

              return (
                <div
                  key={plan.id}
                  className={`${styles.plan} ${plan.popular ? styles.popular : ''}`}
                >
                  {plan.popular && <span className={styles.badge}>Most Popular</span>}
                  <h2 className={styles.planName}>{plan.name}</h2>
                  <div className={styles.price}>
                    <span className={styles.currency}>$</span>
                    <span className={styles.amount}>{displayPrice}</span>
                    <span className={styles.period}>/month</span>
                  </div>
                  {billingPeriod === 'yearly' && (
                    <p className={styles.yearlyTotal}>
                      ${totalYearlyPrice} billed annually
                    </p>
                  )}
                  <p className={styles.credits}>
                    <strong>{plan.credits.toLocaleString()}</strong> credits/month
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
                    disabled={isLoading === plan.id || !stripeConfigured}
                  >
                    {isLoading === plan.id ? (
                      <>
                        <span className={styles.spinner} />
                        Processing...
                      </>
                    ) : currentTier === plan.id ? (
                      'Current Plan'
                    ) : !stripeConfigured ? (
                      'Coming Soon'
                    ) : (
                      'Get Started'
                    )}
                  </button>
                </div>
              );
            })}
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
                {creditPacks.map((pack) => (
                  <div key={pack.credits} className={styles.creditPack}>
                    <div className={styles.packInfo}>
                      <span className={styles.packCredits}>{pack.credits} credits</span>
                      <span className={styles.packPrice}>${pack.price}</span>
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleBuyCredits(pack)}
                      disabled={isLoading === `credits-${pack.credits}` || !stripeConfigured}
                    >
                      {isLoading === `credits-${pack.credits}` ? (
                        <span className={styles.spinner} />
                      ) : !stripeConfigured ? (
                        'Soon'
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

  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
  const priceIds = {
    starterMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || 'price_1SdusgCpgicnCSJySUHiE8I8',
    starterYearly: process.env.STRIPE_PRICE_STARTER_YEARLY || 'price_1Sdv1gCpgicnCSJyM3kJ07mS',
    creatorMonthly: process.env.STRIPE_PRICE_CREATOR_MONTHLY || 'price_1Sdv6uCpgicnCSJyE8EulnlU',
    creatorYearly: process.env.STRIPE_PRICE_CREATOR_YEARLY || 'price_1Sdv8iCpgicnCSJyeaO0loGi',
    studioMonthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY || 'price_1SdvCICpgicnCSJy3gYXGiHR',
    studioYearly: process.env.STRIPE_PRICE_STUDIO_YEARLY || 'price_1SdvCpCpgicnCSJyPa06d2kW',
    credits50: process.env.STRIPE_PRICE_CREDITS_50 || 'price_1SdvEiCpgicnCSJyguGIyASn',
    credits100: process.env.STRIPE_PRICE_CREDITS_100 || 'price_1SdvGkCpgicnCSJykwN4kzak',
    credits250: process.env.STRIPE_PRICE_CREDITS_250 || 'price_1SdvIWCpgicnCSJyWoaJDCzK',
    credits500: process.env.STRIPE_PRICE_CREDITS_500 || 'price_1SdvKLCpgicnCSJyFADi6pY2',
    credits1000: process.env.STRIPE_PRICE_CREDITS_1000 || 'price_1SdvNqCpgicnCSJyv5IcflSN',
  };

  if (!session?.user?.id) {
    return {
      props: {
        isLoggedIn: false,
        stripeConfigured,
        priceIds,
      },
    };
  }

  try {
    const { getUserCredits } = await import('@/utils/db');
    const credits = await getUserCredits(session.user.id);

    return {
      props: {
        isLoggedIn: true,
        currentTier: credits?.subscriptionTier || 'starter',
        creditsRemaining: credits?.creditsRemaining || 0,
        stripeConfigured,
        priceIds,
      },
    };
  } catch {
    return {
      props: {
        isLoggedIn: true,
        creditsRemaining: 0,
        stripeConfigured,
        priceIds,
      },
    };
  }
};

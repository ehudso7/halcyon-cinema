import { useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import { useToast } from '@/components/Toast';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { Project } from '@/types';
import { getAllProjectsAsync } from '@/utils/storage';
import styles from '@/styles/WritersRoom.module.css';

interface WritersRoomProps {
  projects: Project[];
}

type WritersRoomFeature = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tier: 'pro' | 'enterprise';
  action: string;
};

const features: WritersRoomFeature[] = [
  {
    id: 'narrative-generation',
    title: 'AI Narrative Generation',
    description: 'Generate compelling narratives, chapters, and scenes using advanced AI. Let the AI help you craft stories while maintaining your creative vision.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
    ),
    tier: 'pro',
    action: 'Start Writing',
  },
  {
    id: 'chapter-expansion',
    title: 'Chapter Expansion',
    description: 'Expand your chapter outlines into full, detailed chapters. AI helps flesh out scenes, dialogue, and descriptions while keeping your story coherent.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="12" y2="14" />
      </svg>
    ),
    tier: 'pro',
    action: 'Expand Chapters',
  },
  {
    id: 'scene-expansion',
    title: 'Scene Expansion',
    description: 'Transform scene summaries into vivid, detailed scenes. Add sensory details, character interactions, and emotional depth automatically.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" />
        <line x1="17" y1="17" x2="22" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
      </svg>
    ),
    tier: 'pro',
    action: 'Expand Scenes',
  },
  {
    id: 'rewrite-condense',
    title: 'Rewrite & Condense',
    description: 'Rewrite passages for better flow, condense verbose sections, or continue from where you left off. Fine-tune your prose with AI assistance.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    tier: 'pro',
    action: 'Edit Content',
  },
  {
    id: 'canon-validation',
    title: 'Canon Validation',
    description: 'Ensure story consistency by validating new content against your established canon. Catch contradictions before they become plot holes.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    tier: 'pro',
    action: 'Validate Canon',
  },
  {
    id: 'ai-author-controls',
    title: 'AI Author Controls',
    description: 'Fine-tune AI behavior with author controls. Adjust tone, style, pacing, and creativity levels to match your unique voice.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
    tier: 'enterprise',
    action: 'Configure AI',
  },
];

export default function WritersRoom({ projects }: WritersRoomProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [selectedProject, setSelectedProject] = useState<string>('');

  const handleFeatureClick = (feature: WritersRoomFeature) => {
    if (!selectedProject) {
      showToast('Please select a project first', 'warning');
      return;
    }

    // Navigate to project with Writer's Room mode
    router.push(`/project/${selectedProject}?mode=writers-room&feature=${feature.id}`);
  };

  const userName = session?.user?.name?.split(' ')[0] || 'Creator';

  return (
    <>
      <Head>
        <title>Writer&apos;s Room | Halcyon Cinema</title>
        <meta name="description" content="AI-powered narrative engine for creating compelling stories, chapters, and scenes" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          {/* Hero Section */}
          <div className={styles.hero}>
            <div className={styles.heroIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            </div>
            <h1 className={styles.title}>Writer&apos;s Room</h1>
            <p className={styles.subtitle}>
              Your AI-powered narrative engine. Craft compelling stories, expand chapters,
              and maintain perfect canon consistency across your cinematic works.
            </p>
          </div>

          {/* Project Selector */}
          <div className={styles.projectSelector}>
            <label htmlFor="project-select" className={styles.selectorLabel}>
              Select a project to begin:
            </label>
            <select
              id="project-select"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className={styles.selectorDropdown}
            >
              <option value="">Choose a project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {projects.length === 0 && (
              <p className={styles.noProjects}>
                No projects yet.{' '}
                <Link href="/" className={styles.createLink}>
                  Create your first project
                </Link>{' '}
                to get started with Writer&apos;s Room.
              </p>
            )}
          </div>

          {/* Features Grid */}
          <section className={styles.featuresSection}>
            <h2 className={styles.sectionTitle}>Writer&apos;s Room Features</h2>
            <div className={styles.featuresGrid}>
              {features.map((feature) => (
                <div
                  key={feature.id}
                  className={`${styles.featureCard} ${!selectedProject ? styles.disabled : ''}`}
                  onClick={() => handleFeatureClick(feature)}
                >
                  <div className={styles.featureIcon}>{feature.icon}</div>
                  <div className={styles.featureContent}>
                    <div className={styles.featureHeader}>
                      <h3 className={styles.featureTitle}>{feature.title}</h3>
                      <span className={`${styles.tierBadge} ${styles[feature.tier]}`}>
                        {feature.tier === 'pro' ? 'Pro' : 'Enterprise'}
                      </span>
                    </div>
                    <p className={styles.featureDescription}>{feature.description}</p>
                    <button
                      className={styles.featureButton}
                      disabled={!selectedProject}
                    >
                      {feature.action}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* How It Works */}
          <section className={styles.howItWorks}>
            <h2 className={styles.sectionTitle}>How Writer&apos;s Room Works</h2>
            <div className={styles.stepsGrid}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <h3 className={styles.stepTitle}>Select Your Project</h3>
                <p className={styles.stepDescription}>
                  Choose an existing project or create a new one to begin your creative journey.
                </p>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <h3 className={styles.stepTitle}>Choose a Feature</h3>
                <p className={styles.stepDescription}>
                  Select from narrative generation, chapter expansion, or other powerful tools.
                </p>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <h3 className={styles.stepTitle}>Guide the AI</h3>
                <p className={styles.stepDescription}>
                  Provide prompts and direction. The AI generates content while respecting your canon.
                </p>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>4</div>
                <h3 className={styles.stepTitle}>Refine & Export</h3>
                <p className={styles.stepDescription}>
                  Edit, refine, and export your completed work in multiple formats.
                </p>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className={styles.ctaSection}>
            <div className={styles.ctaContent}>
              <h2 className={styles.ctaTitle}>Ready to write your story?</h2>
              <p className={styles.ctaDescription}>
                Writer&apos;s Room features are available to Pro and Enterprise subscribers.
                Upgrade today to unlock the full power of AI-assisted storytelling.
              </p>
              <div className={styles.ctaButtons}>
                <Link href="/pricing" className="btn btn-primary">
                  View Pricing Plans
                </Link>
                <Link href="/" className="btn btn-secondary">
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<WritersRoomProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  // Redirect to landing if not authenticated
  if (!session?.user?.id) {
    return {
      redirect: {
        destination: '/auth/signin?callbackUrl=/writers-room',
        permanent: false,
      },
    };
  }

  try {
    const userProjects = await getAllProjectsAsync(session.user.id);

    return {
      props: {
        projects: userProjects,
      },
    };
  } catch (error) {
    console.error('Failed to load projects:', error);
    return {
      props: {
        projects: [],
      },
    };
  }
};

import { useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import ProjectCard from '@/components/ProjectCard';
import CreateProjectModal from '@/components/CreateProjectModal';
import { Project } from '@/types';
import { getAllProjectsAsync } from '@/utils/storage';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import styles from '@/styles/Home.module.css';

interface HomeProps {
  projects: Project[];
}

export default function Home({ projects: initialProjects }: HomeProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Get the most recently updated project for "Continue" button
  const lastProject = projects.length > 0
    ? projects.reduce((latest, current) =>
        new Date(current.updatedAt) > new Date(latest.updatedAt) ? current : latest
      )
    : null;

  const userName = session?.user?.name?.split(' ')[0] || 'Creator';

  const handleCreateProject = async (name: string, description: string) => {
    setIsCreating(true);
    setCreateError('');
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          // Session expired, redirect to sign in
          router.push('/auth/signin');
          return;
        }
        throw new Error(errorData.error || 'Failed to create project');
      }

      const newProject = await response.json();
      setProjects(prev => [newProject, ...prev]);
      setIsModalOpen(false);
      setCreateError('');
      router.push(`/project/${newProject.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      setCreateError(error instanceof Error ? error.message : 'Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCreateError('');
  };

  return (
    <>
      <Head>
        <title>HALCYON-Cinema | AI Cinematic Content Studio</title>
        <meta name="description" content="Build scenes, storyboards, artworks, and cinematic media from natural-language prompts" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <div className={styles.hero}>
            <h1 className={styles.title}>Welcome back, {userName}.</h1>
            <p className={styles.subtitle}>
              Your cinematic studio awaits. Create stunning visuals from natural-language prompts,
              build storyboards, and bring your stories to life with AI.
            </p>
            <div className={styles.heroButtons}>
              {lastProject && (
                <Link href={`/project/${lastProject.id}`} className="btn btn-secondary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Continue: {lastProject.name}
                </Link>
              )}
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn btn-primary"
                disabled={isCreating}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {projects.length === 0 ? 'Start Your First Project' : 'Create New Project'}
              </button>
            </div>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Your Projects</h2>
            {projects.length > 0 ? (
              <div className="grid grid-2">
                {projects.map(project => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🎬</div>
                <h3>Your studio is ready</h3>
                <p>Start your first project and watch your vision come to life with AI-powered scene generation.</p>
                <div className={styles.emptyFeatures}>
                  <div className={styles.emptyFeature}>
                    <span>📝</span>
                    <span>Describe scenes in plain English</span>
                  </div>
                  <div className={styles.emptyFeature}>
                    <span>🎨</span>
                    <span>Choose from 12+ visual styles</span>
                  </div>
                  <div className={styles.emptyFeature}>
                    <span>📄</span>
                    <span>Export as PDF or ZIP</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleCreateProject}
        isSubmitting={isCreating}
        externalError={createError}
      />
    </>
  );
}

export const getServerSideProps: GetServerSideProps<HomeProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  // Redirect to sign in if not authenticated
  if (!session?.user?.id) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }

  try {
    // Get only the user's projects
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

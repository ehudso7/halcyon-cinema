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
import { getAllProjects } from '@/utils/storage';
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

  // Get the most recently updated project for "Continue" button
  const lastProject = projects.length > 0
    ? projects.reduce((latest, current) =>
        new Date(current.updatedAt) > new Date(latest.updatedAt) ? current : latest
      )
    : null;

  const userName = session?.user?.name?.split(' ')[0] || 'Creator';

  const handleCreateProject = async (name: string, description: string) => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const newProject = await response.json();
      setProjects(prev => [newProject, ...prev]);
      setIsModalOpen(false);
      router.push(`/project/${newProject.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
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
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateProject}
      />
    </>
  );
}

export const getServerSideProps: GetServerSideProps<HomeProps> = async () => {
  const projects = getAllProjects();
  return {
    props: {
      projects,
    },
  };
};

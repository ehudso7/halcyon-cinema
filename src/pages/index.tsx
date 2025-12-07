import { useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import ProjectCard from '@/components/ProjectCard';
import CreateProjectModal from '@/components/CreateProjectModal';
import { Project } from '@/types';
import { getAllProjects } from '@/utils/storage';
import styles from '@/styles/Home.module.css';

interface HomeProps {
  projects: Project[];
}

export default function Home({ projects: initialProjects }: HomeProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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
            <h1 className={styles.title}>Welcome to HALCYON-Cinema</h1>
            <p className={styles.subtitle}>
              Create stunning cinematic visuals from natural-language prompts.
              Build scenes, storyboards, and artworks powered by AI.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-primary"
              disabled={isCreating}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create New Project
            </button>
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
              <div className="empty-state">
                <h3>No projects yet</h3>
                <p>Create your first project to get started with AI-powered cinematic content.</p>
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

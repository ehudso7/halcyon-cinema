import { useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import SceneCard from '@/components/SceneCard';
import PromptBuilder, { PromptData } from '@/components/PromptBuilder';
import { Project } from '@/types';
import { getProjectById } from '@/utils/storage';
import styles from '@/styles/Project.module.css';

interface ProjectPageProps {
  project: Project;
}

export default function ProjectPage({ project: initialProject }: ProjectPageProps) {
  const router = useRouter();
  const [project, setProject] = useState<Project>(initialProject);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPromptBuilder, setShowPromptBuilder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateScene = async (data: PromptData) => {
    setIsGenerating(true);
    setError(null);

    try {
      // Generate image
      const imageResponse = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: data.prompt,
          shotType: data.shotType,
          style: data.style,
          lighting: data.lighting,
          mood: data.mood,
          size: data.aspectRatio,
        }),
      });

      const imageResult = await imageResponse.json();

      if (!imageResult.success) {
        throw new Error(imageResult.error || 'Failed to generate image');
      }

      // Save scene
      const sceneResponse = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          prompt: data.prompt,
          imageUrl: imageResult.imageUrl,
          metadata: {
            shotType: data.shotType,
            style: data.style,
            lighting: data.lighting,
            mood: data.mood,
            aspectRatio: data.aspectRatio,
          },
        }),
      });

      if (!sceneResponse.ok) {
        throw new Error('Failed to save scene');
      }

      const newScene = await sceneResponse.json();

      // Update local state
      setProject(prev => ({
        ...prev,
        scenes: [...prev.scenes, newScene],
      }));

      setShowPromptBuilder(false);

      // Navigate to the new scene
      router.push(`/project/${project.id}/scene/${newScene.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      router.push('/');
    } catch {
      alert('Failed to delete project');
    }
  };

  return (
    <>
      <Head>
        <title>{project.name} | HALCYON-Cinema</title>
        <meta name="description" content={project.description || `Scenes for ${project.name}`} />
      </Head>

      <Header showBackLink backLinkHref="/" backLinkText="Projects" />

      <main className="page">
        <div className="container">
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <h1 className={styles.title}>{project.name}</h1>
              {project.description && (
                <p className={styles.description}>{project.description}</p>
              )}
              <p className={styles.meta}>
                {project.scenes.length} {project.scenes.length === 1 ? 'scene' : 'scenes'}
              </p>
            </div>
            <div className={styles.headerActions}>
              <button
                onClick={() => setShowPromptBuilder(!showPromptBuilder)}
                className="btn btn-primary"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Scene
              </button>
              <button
                onClick={handleDeleteProject}
                className="btn btn-secondary"
                title="Delete Project"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>
          </div>

          {showPromptBuilder && (
            <div className={styles.promptBuilderWrapper}>
              <PromptBuilder onSubmit={handleGenerateScene} isLoading={isGenerating} />
              {error && <p className={styles.error}>{error}</p>}
            </div>
          )}

          <section className={styles.gallery}>
            {project.scenes.length > 0 ? (
              <div className="grid grid-3">
                {project.scenes.map((scene, index) => (
                  <SceneCard key={scene.id} scene={scene} index={index} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>No scenes yet</h3>
                <p>Click "Add Scene" to create your first scene with AI-generated visuals.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ProjectPageProps> = async ({ params }) => {
  const projectId = params?.projectId as string;
  const project = getProjectById(projectId);

  if (!project) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      project,
    },
  };
};

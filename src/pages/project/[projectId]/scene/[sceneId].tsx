import { useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import PromptBuilder, { PromptData } from '@/components/PromptBuilder';
import { Project, Scene } from '@/types';
import { getProjectById, getSceneById } from '@/utils/storage';
import styles from '@/styles/Scene.module.css';

interface ScenePageProps {
  project: Project;
  scene: Scene;
  sceneIndex: number;
}

export default function ScenePage({ project, scene: initialScene, sceneIndex }: ScenePageProps) {
  const router = useRouter();
  const [scene, setScene] = useState<Scene>(initialScene);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegenerate = async (data: PromptData) => {
    setIsRegenerating(true);
    setError(null);

    try {
      // Generate new image
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

      // Update scene
      const updateResponse = await fetch(`/api/scenes/${scene.id}?projectId=${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

      if (!updateResponse.ok) {
        throw new Error('Failed to update scene');
      }

      const updatedScene = await updateResponse.json();
      setScene(updatedScene);
      setShowRegenerate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this scene?')) {
      return;
    }

    try {
      const response = await fetch(`/api/scenes/${scene.id}?projectId=${project.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete scene');
      }

      router.push(`/project/${project.id}`);
    } catch {
      alert('Failed to delete scene');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Head>
        <title>Scene {sceneIndex + 1} - {project.name} | HALCYON-Cinema</title>
      </Head>

      <Header
        showBackLink
        backLinkHref={`/project/${project.id}`}
        backLinkText={project.name}
      />

      <main className="page">
        <div className="container">
          <div className={styles.viewer}>
            <div className={styles.imageContainer}>
              {scene.imageUrl ? (
                <img src={scene.imageUrl} alt={`Scene ${sceneIndex + 1}`} className={styles.image} />
              ) : (
                <div className={styles.placeholder}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <p>No image generated</p>
                </div>
              )}
            </div>

            <div className={styles.details}>
              <div className={styles.header}>
                <h1 className={styles.title}>Scene {sceneIndex + 1}</h1>
                <div className={styles.actions}>
                  <button
                    onClick={() => setShowRegenerate(!showRegenerate)}
                    className="btn btn-secondary"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                    </svg>
                    Regenerate
                  </button>
                  <button onClick={handleDelete} className="btn btn-secondary" title="Delete Scene">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Prompt</h2>
                <p className={styles.prompt}>{scene.prompt}</p>
              </div>

              {scene.metadata && Object.keys(scene.metadata).some(k => scene.metadata?.[k as keyof typeof scene.metadata]) && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Metadata</h2>
                  <div className={styles.metadata}>
                    {scene.metadata.shotType && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Shot Type</span>
                        <span className={styles.metaValue}>{scene.metadata.shotType}</span>
                      </div>
                    )}
                    {scene.metadata.style && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Style</span>
                        <span className={styles.metaValue}>{scene.metadata.style}</span>
                      </div>
                    )}
                    {scene.metadata.lighting && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Lighting</span>
                        <span className={styles.metaValue}>{scene.metadata.lighting}</span>
                      </div>
                    )}
                    {scene.metadata.mood && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Mood</span>
                        <span className={styles.metaValue}>{scene.metadata.mood}</span>
                      </div>
                    )}
                    {scene.metadata.aspectRatio && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Aspect Ratio</span>
                        <span className={styles.metaValue}>{scene.metadata.aspectRatio}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Timestamps</h2>
                <div className={styles.timestamps}>
                  <p><strong>Created:</strong> {formatDate(scene.createdAt)}</p>
                  <p><strong>Updated:</strong> {formatDate(scene.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>

          {showRegenerate && (
            <div className={styles.regenerateSection}>
              <h2 className={styles.sectionTitle}>Regenerate Scene</h2>
              <PromptBuilder
                onSubmit={handleRegenerate}
                isLoading={isRegenerating}
                initialPrompt={scene.prompt}
              />
              {error && <p className={styles.error}>{error}</p>}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ScenePageProps> = async ({ params }) => {
  const projectId = params?.projectId as string;
  const sceneId = params?.sceneId as string;

  const project = getProjectById(projectId);
  if (!project) {
    return { notFound: true };
  }

  const scene = getSceneById(projectId, sceneId);
  if (!scene) {
    return { notFound: true };
  }

  const sceneIndex = project.scenes.findIndex(s => s.id === sceneId);

  return {
    props: {
      project,
      scene,
      sceneIndex,
    },
  };
};

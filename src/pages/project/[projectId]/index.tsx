import { useState, useMemo } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import Breadcrumb from '@/components/Breadcrumb';
import ProductionProgress from '@/components/ProductionProgress';
import ProjectNavigation from '@/components/ProjectNavigation';
import SceneCard from '@/components/SceneCard';
import Pagination from '@/components/Pagination';
import PromptBuilder, { PromptData } from '@/components/PromptBuilder';
import { Project } from '@/types';
import { getProjectByIdAsync } from '@/utils/storage';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import styles from '@/styles/Project.module.css';

const SCENES_PER_PAGE = 12;

interface ProjectPageProps {
  project: Project;
}

export default function ProjectPage({ project: initialProject }: ProjectPageProps) {
  const router = useRouter();
  const [project, setProject] = useState<Project>(initialProject);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPromptBuilder, setShowPromptBuilder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Paginated scenes
  const paginatedScenes = useMemo(() => {
    const startIndex = (currentPage - 1) * SCENES_PER_PAGE;
    return project.scenes.slice(startIndex, startIndex + SCENES_PER_PAGE);
  }, [project.scenes, currentPage]);

  const totalPages = Math.ceil(project.scenes.length / SCENES_PER_PAGE);

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
          characterIds: data.characterIds,
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

  const handleExport = () => {
    window.open(`/api/export/project/${project.id}`, '_blank');
  };

  return (
    <>
      <Head>
        <title>{project.name} | HALCYON-Cinema</title>
        <meta name="description" content={project.description || `Scenes for ${project.name}`} />
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <Breadcrumb
            items={[
              { label: 'Projects', href: '/' },
              { label: project.name },
            ]}
          />

          <ProductionProgress project={project} />

          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <h1 className={styles.title}>{project.name}</h1>
              {project.description && (
                <p className={styles.description}>{project.description}</p>
              )}
              <p className={styles.meta}>
                {project.scenes.length} {project.scenes.length === 1 ? 'scene' : 'scenes'}
                {project.lore && project.lore.length > 0 && ` • ${project.lore.length} lore entries`}
                {project.characters && project.characters.length > 0 && ` • ${project.characters.length} characters`}
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
                onClick={handleExport}
                className="btn btn-secondary"
                title="Export Project"
                disabled={project.scenes.length === 0}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Export
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

          <ProjectNavigation projectId={project.id} activeTab="scenes" />

          {showPromptBuilder && (
            <div className={styles.promptBuilderWrapper}>
              <PromptBuilder
                onSubmit={handleGenerateScene}
                isLoading={isGenerating}
                characters={project.characters || []}
              />
              {error && <p className={styles.error}>{error}</p>}
            </div>
          )}

          <section className={styles.gallery}>
            {project.scenes.length > 0 ? (
              <>
                <div className="grid grid-3">
                  {paginatedScenes.map((scene, index) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      index={(currentPage - 1) * SCENES_PER_PAGE + index}
                    />
                  ))}
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={project.scenes.length}
                  itemsPerPage={SCENES_PER_PAGE}
                />
              </>
            ) : (
              <div className="empty-state">
                <h3>No scenes yet</h3>
                <p>Click &ldquo;Add Scene&rdquo; to create your first scene with AI-generated visuals.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ProjectPageProps> = async (context) => {
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

  const projectId = context.params?.projectId as string;

  try {
    const project = await getProjectByIdAsync(projectId);

    if (!project) {
      return {
        notFound: true,
      };
    }

    // Verify user owns this project (strict check - projects must have userId)
    if (project.userId !== session.user.id) {
      return {
        notFound: true,
      };
    }

    return {
      props: {
        project,
      },
    };
  } catch (error) {
    console.error('Failed to load project:', error);
    return {
      notFound: true,
    };
  }
};

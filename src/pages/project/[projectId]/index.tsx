import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import Breadcrumb from '@/components/Breadcrumb';
import ProductionProgress from '@/components/ProductionProgress';
import ProjectNavigation from '@/components/ProjectNavigation';
import SceneCard from '@/components/SceneCard';
import SceneFilters from '@/components/SceneFilters';
import Pagination from '@/components/Pagination';
import PromptBuilder, { PromptData } from '@/components/PromptBuilder';
import GenerationProgress from '@/components/GenerationProgress';
import Warning from '@/components/Warning';
import StoryForgePanel from '@/components/StoryForgePanel';
import { trackGeneration } from '@/components/UsageStats';
import { Project, Scene, StoryForgeFeatureId, isValidStoryForgeFeatureId } from '@/types';
import { getProjectByIdAsync } from '@/utils/storage';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import styles from '@/styles/Project.module.css';

const SCENES_PER_PAGE = 12;

type SortOption = 'newest' | 'oldest' | 'shot-type' | 'mood';
type ViewMode = 'grid' | 'list';

interface ProjectPageProps {
  project: Project;
}

export default function ProjectPage({ project: initialProject }: ProjectPageProps) {
  const router = useRouter();
  const [project, setProject] = useState<Project>(initialProject);
  const [filteredScenes, setFilteredScenes] = useState<Scene[]>(initialProject.scenes);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPromptBuilder, setShowPromptBuilder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');

  // New states for enhanced features
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(new Set());
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(project.name);
  const [editedDescription, setEditedDescription] = useState(project.description || '');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [imageWarning, setImageWarning] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // StoryForge mode detection from query parameters
  const isStoryForgeMode = router.query.mode === 'storyforge';
  const queryFeature = router.query.feature as string | undefined;
  const storyForgeFeature = queryFeature && isValidStoryForgeFeatureId(queryFeature)
    ? queryFeature
    : null;

  // Handle exiting StoryForge mode
  const handleExitStoryForge = useCallback(() => {
    router.push(`/project/${project.id}`, undefined, { shallow: true });
  }, [router, project.id]);

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('halcyon_project_view_mode');
    if (savedViewMode === 'grid' || savedViewMode === 'list') {
      setViewMode(savedViewMode);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
          setIsEditingTitle(false);
        }
        return;
      }

      switch (e.key) {
        case 'n':
          e.preventDefault();
          setShowPromptBuilder(true);
          break;
        case 'Escape':
          setShowPromptBuilder(false);
          setSelectedScenes(new Set());
          setShowDeleteModal(false);
          setShowBulkDeleteModal(false);
          setShowKeyboardHelp(false);
          break;
        case 'g':
          setViewMode('grid');
          localStorage.setItem('halcyon_project_view_mode', 'grid');
          break;
        case 'l':
          setViewMode('list');
          localStorage.setItem('halcyon_project_view_mode', 'list');
          break;
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const allIds = new Set(filteredScenes.map(s => s.id));
            setSelectedScenes(allIds);
          }
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardHelp(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredScenes]);

  // Handle filter changes
  const handleFilterChange = useCallback((scenes: Scene[]) => {
    setFilteredScenes(scenes);
    setCurrentPage(1);
    setSelectedScenes(new Set());
  }, []);

  // Sort scenes
  const sortedScenes = useMemo(() => {
    const scenes = [...filteredScenes];
    switch (sortBy) {
      case 'newest':
        return scenes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'oldest':
        return scenes.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'shot-type':
        return scenes.sort((a, b) => (a.metadata?.shotType || '').localeCompare(b.metadata?.shotType || ''));
      case 'mood':
        return scenes.sort((a, b) => (a.metadata?.mood || '').localeCompare(b.metadata?.mood || ''));
      default:
        return scenes;
    }
  }, [filteredScenes, sortBy]);

  // Paginated scenes
  const paginatedScenes = useMemo(() => {
    const startIndex = (currentPage - 1) * SCENES_PER_PAGE;
    return sortedScenes.slice(startIndex, startIndex + SCENES_PER_PAGE);
  }, [sortedScenes, currentPage]);

  const totalPages = Math.ceil(sortedScenes.length / SCENES_PER_PAGE);

  // Selection helpers
  const toggleSceneSelection = (sceneId: string) => {
    setSelectedScenes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sceneId)) {
        newSet.delete(sceneId);
      } else {
        newSet.add(sceneId);
      }
      return newSet;
    });
  };

  const selectAllOnPage = () => {
    const pageIds = new Set(paginatedScenes.map(s => s.id));
    setSelectedScenes(pageIds);
  };

  const clearSelection = () => {
    setSelectedScenes(new Set());
  };

  const handleGenerateScene = async (data: PromptData) => {
    setIsGenerating(true);
    setError(null);
    setImageWarning(null);
    setCurrentPrompt(data.prompt);

    try {
      let mediaUrl: string;
      let mediaType: 'image' | 'video' = 'image';

      if (data.contentType === 'video') {
        // Generate video
        const videoResponse = await fetch('/api/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: data.prompt,
            aspectRatio: data.aspectRatio === '1792x1024' ? '16:9' : data.aspectRatio === '1024x1792' ? '9:16' : '1:1',
          }),
        });

        const videoResult = await videoResponse.json();

        if (!videoResult.success && videoResult.status !== 'processing') {
          throw new Error(videoResult.error || 'Failed to generate video');
        }

        // Handle async video generation (may still be processing)
        if (videoResult.status === 'processing') {
          // Poll for completion
          const maxAttempts = 60; // 2 minutes total (2s intervals)
          let attempts = 0;
          let finalVideoUrl: string | null = null;

          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;

            try {
              const statusResponse = await fetch(`/api/prediction-status/${videoResult.predictionId}`);
              const statusResult = await statusResponse.json();

              if (statusResult.status === 'succeeded' && statusResult.output) {
                finalVideoUrl = statusResult.output;
                break;
              } else if (statusResult.status === 'failed') {
                throw new Error(statusResult.error || 'Video generation failed');
              } else if (statusResult.status === 'canceled') {
                throw new Error('Video generation was canceled');
              }
            } catch (err) {
              if (err instanceof Error && (err.message === 'Video generation failed' || err.message === 'Video generation was canceled')) {
                throw err;
              }
              // Network error, continue polling
            }
          }

          if (!finalVideoUrl) {
            throw new Error('Video generation timed out. Please try again.');
          }
          mediaUrl = finalVideoUrl;
        } else {
          mediaUrl = videoResult.videoUrl;
        }
        mediaType = 'video';
      } else {
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
            projectId: project.id,
          }),
        });

        const imageResult = await imageResponse.json();

        if (!imageResult.success) {
          throw new Error(imageResult.error || 'Failed to generate image');
        }

        // Show warning if image URL is temporary (storage not configured or failed)
        if (imageResult.urlType === 'temporary' && imageResult.warning) {
          setImageWarning(imageResult.warning);
        }

        mediaUrl = imageResult.imageUrl;
      }

      const sceneResponse = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          prompt: data.prompt,
          imageUrl: mediaUrl,
          metadata: {
            shotType: data.shotType,
            style: data.style,
            lighting: data.lighting,
            mood: data.mood,
            aspectRatio: data.aspectRatio,
            mediaType,
          },
          characterIds: data.characterIds,
        }),
      });

      if (!sceneResponse.ok) {
        throw new Error('Failed to save scene');
      }

      const newScene = await sceneResponse.json();

      // Track the generation for credits system
      trackGeneration();

      setProject(prev => ({
        ...prev,
        scenes: [...prev.scenes, newScene],
      }));
      setFilteredScenes(prev => [...prev, newScene]);
      setShowPromptBuilder(false);
      router.push(`/project/${project.id}/scene/${newScene.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateProject = async () => {
    if (!editedTitle.trim()) return;

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedTitle.trim(),
          description: editedDescription.trim() || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update project');

      const updatedProject = await response.json();
      setProject(prev => ({ ...prev, ...updatedProject }));
      setIsEditingTitle(false);
    } catch {
      alert('Failed to update project');
    }
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete project');

      router.push('/');
    } catch {
      alert('Failed to delete project');
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedScenes.size === 0) return;

    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedScenes).map(sceneId =>
        fetch(`/api/scenes/${sceneId}?projectId=${project.id}`, { method: 'DELETE' })
      );

      await Promise.all(deletePromises);

      setProject(prev => ({
        ...prev,
        scenes: prev.scenes.filter(s => !selectedScenes.has(s.id)),
      }));
      setFilteredScenes(prev => prev.filter(s => !selectedScenes.has(s.id)));
      setSelectedScenes(new Set());
      setShowBulkDeleteModal(false);
    } catch {
      alert('Failed to delete some scenes');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicateScene = async (scene: Scene) => {
    try {
      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          prompt: scene.prompt,
          imageUrl: scene.imageUrl,
          metadata: scene.metadata,
          characterIds: scene.characterIds,
        }),
      });

      if (!response.ok) throw new Error('Failed to duplicate scene');

      const newScene = await response.json();
      setProject(prev => ({
        ...prev,
        scenes: [...prev.scenes, newScene],
      }));
      setFilteredScenes(prev => [...prev, newScene]);
    } catch {
      alert('Failed to duplicate scene');
    }
  };

  const handleExport = () => {
    window.open(`/api/export/project/${project.id}`, '_blank');
  };

  const handleExportSelected = () => {
    const sceneIds = Array.from(selectedScenes).join(',');
    window.open(`/api/export/project/${project.id}?scenes=${sceneIds}`, '_blank');
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
              {isEditingTitle ? (
                <div className={styles.editTitleForm}>
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={editedTitle}
                    onChange={e => setEditedTitle(e.target.value)}
                    className={styles.titleInput}
                    placeholder="Project name"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleUpdateProject();
                      if (e.key === 'Escape') {
                        setIsEditingTitle(false);
                        setEditedTitle(project.name);
                      }
                    }}
                  />
                  <textarea
                    value={editedDescription}
                    onChange={e => setEditedDescription(e.target.value)}
                    className={styles.descriptionInput}
                    placeholder="Add a description..."
                    rows={2}
                  />
                  <div className={styles.editActions}>
                    <button onClick={handleUpdateProject} className="btn btn-primary btn-sm">
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingTitle(false);
                        setEditedTitle(project.name);
                        setEditedDescription(project.description || '');
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.titleRow}>
                    <h1 className={styles.title}>{project.name}</h1>
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className={styles.editButton}
                      title="Edit project details"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                  {project.description && (
                    <p className={styles.description}>{project.description}</p>
                  )}
                  <p className={styles.meta}>
                    {project.scenes.length} {project.scenes.length === 1 ? 'scene' : 'scenes'}
                    {project.lore && project.lore.length > 0 && ` • ${project.lore.length} lore entries`}
                    {project.characters && project.characters.length > 0 && ` • ${project.characters.length} characters`}
                  </p>
                </>
              )}
            </div>
            <div className={styles.headerActions}>
              <button
                onClick={() => setShowPromptBuilder(!showPromptBuilder)}
                className="btn btn-primary"
                title="Add new scene (N)"
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
                onClick={() => setShowDeleteModal(true)}
                className="btn btn-secondary btn-danger-hover"
                title="Delete Project"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>
          </div>

          <ProjectNavigation projectId={project.id} activeTab="scenes" />

          {/* StoryForge Mode Panel */}
          {isStoryForgeMode && (
            <StoryForgePanel
              project={project}
              featureId={storyForgeFeature}
              onClose={handleExitStoryForge}
            />
          )}

          {/* Cinema Mode Content */}
          {!isStoryForgeMode && showPromptBuilder && (
            <div className={styles.promptBuilderWrapper}>
              <PromptBuilder
                onSubmit={handleGenerateScene}
                isLoading={isGenerating}
                characters={project.characters || []}
              />
              <GenerationProgress
                isGenerating={isGenerating}
                error={error}
                prompt={currentPrompt}
              />
              {error && !isGenerating && <p className={styles.error}>{error}</p>}
              {imageWarning && !isGenerating && <Warning message={imageWarning} />}
            </div>
          )}

          {!isStoryForgeMode && project.scenes.length > 0 && (
            <>
              <SceneFilters
                scenes={project.scenes}
                characters={project.characters}
                onFilterChange={handleFilterChange}
              />

              <div className={styles.controls}>
                <div className={styles.sortAndView}>
                  <div className={styles.sortSelect}>
                    <label htmlFor="sort">Sort:</label>
                    <select
                      id="sort"
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as SortOption)}
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="shot-type">Shot Type</option>
                      <option value="mood">Mood</option>
                    </select>
                  </div>

                  <div className={styles.viewToggle}>
                    <button
                      className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
                      onClick={() => {
                        setViewMode('grid');
                        localStorage.setItem('halcyon_project_view_mode', 'grid');
                      }}
                      title="Grid view (G)"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                      </svg>
                    </button>
                    <button
                      className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
                      onClick={() => {
                        setViewMode('list');
                        localStorage.setItem('halcyon_project_view_mode', 'list');
                      }}
                      title="List view (L)"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>

                {selectedScenes.size > 0 && (
                  <div className={styles.bulkActions}>
                    <span className={styles.selectedCount}>
                      {selectedScenes.size} selected
                    </span>
                    <button onClick={handleExportSelected} className="btn btn-secondary btn-sm">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Export
                    </button>
                    <button
                      onClick={() => setShowBulkDeleteModal(true)}
                      className="btn btn-secondary btn-sm btn-danger"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                      Delete
                    </button>
                    <button onClick={clearSelection} className="btn btn-secondary btn-sm">
                      Clear
                    </button>
                  </div>
                )}

                {selectedScenes.size === 0 && paginatedScenes.length > 0 && (
                  <button onClick={selectAllOnPage} className={styles.selectAllBtn}>
                    Select All
                  </button>
                )}
              </div>
            </>
          )}

          {!isStoryForgeMode && (
          <section className={styles.gallery}>
            {project.scenes.length > 0 ? (
              <>
                {sortedScenes.length > 0 ? (
                  <>
                    <div className={viewMode === 'grid' ? 'grid grid-3' : styles.listView}>
                      {paginatedScenes.map((scene, index) => (
                        <SceneCard
                          key={scene.id}
                          scene={scene}
                          index={(currentPage - 1) * SCENES_PER_PAGE + index}
                          viewMode={viewMode}
                          isSelected={selectedScenes.has(scene.id)}
                          onSelect={() => toggleSceneSelection(scene.id)}
                          onDuplicate={() => handleDuplicateScene(scene)}
                        />
                      ))}
                    </div>
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      totalItems={sortedScenes.length}
                      itemsPerPage={SCENES_PER_PAGE}
                    />
                  </>
                ) : (
                  <div className="empty-state">
                    <h3>No matching scenes</h3>
                    <p>Try adjusting your filters or search term.</p>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                    <line x1="7" y1="2" x2="7" y2="22" />
                    <line x1="17" y1="2" x2="17" y2="22" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <line x1="2" y1="7" x2="7" y2="7" />
                    <line x1="2" y1="17" x2="7" y2="17" />
                    <line x1="17" y1="17" x2="22" y2="17" />
                    <line x1="17" y1="7" x2="22" y2="7" />
                  </svg>
                </div>
                <h3>No scenes yet</h3>
                <p>Create your first scene with AI-generated visuals</p>
                <button
                  onClick={() => setShowPromptBuilder(true)}
                  className="btn btn-primary"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Create First Scene
                </button>
              </div>
            )}
          </section>
          )}
        </div>
      </main>

      {/* Delete Project Modal */}
      {showDeleteModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </div>
            <h3>Delete Project?</h3>
            <p>
              Are you sure you want to delete &ldquo;{project.name}&rdquo;?
              This will permanently remove all {project.scenes.length} scenes and cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-secondary"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                className="btn btn-danger"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className={styles.modalOverlay} onClick={() => setShowBulkDeleteModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </div>
            <h3>Delete {selectedScenes.size} Scenes?</h3>
            <p>
              Are you sure you want to delete the selected scenes?
              This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="btn btn-secondary"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="btn btn-danger"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Scenes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      {showKeyboardHelp && (
        <div className={styles.modalOverlay} onClick={() => setShowKeyboardHelp(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>Keyboard Shortcuts</h3>
            <div className={styles.shortcutsList}>
              <div className={styles.shortcut}>
                <kbd>N</kbd>
                <span>Add new scene</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>G</kbd>
                <span>Grid view</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>L</kbd>
                <span>List view</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>Ctrl+A</kbd>
                <span>Select all scenes</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>Esc</kbd>
                <span>Close modals / Clear selection</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>?</kbd>
                <span>Show this help</span>
              </div>
            </div>
            <button onClick={() => setShowKeyboardHelp(false)} className="btn btn-primary">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ProjectPageProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

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
      return { notFound: true };
    }

    if (project.userId !== session.user.id) {
      return { notFound: true };
    }

    return { props: { project } };
  } catch (error) {
    console.error('Failed to load project:', error);
    return { notFound: true };
  }
};

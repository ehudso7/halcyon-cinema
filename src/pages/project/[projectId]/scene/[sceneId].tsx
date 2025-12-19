/**
 * Scene Detail Page Component
 *
 * Displays a single scene's details and provides functionality for:
 * - Viewing the scene image/video in fullscreen with zoom controls
 * - Regenerating scene media with new prompts
 * - Managing scene notes and metadata
 * - Viewing image generation history
 * - Comparing different versions of generated images
 * - Sharing scene content
 *
 * @module pages/project/[projectId]/scene/[sceneId]
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Header from '@/components/Header';
import Breadcrumb from '@/components/Breadcrumb';
import PromptBuilder, { PromptData } from '@/components/PromptBuilder';
import ImageWithFallback from '@/components/ImageWithFallback';
import ShareButton from '@/components/ShareButton';
import Warning from '@/components/Warning';
import { trackGeneration } from '@/components/UsageStats';
import { Project, Scene } from '@/types';
import { getProjectByIdAsync, getSceneByIdAsync } from '@/utils/storage';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { useCSRF } from '@/hooks/useCSRF';
import styles from '@/styles/Scene.module.css';

interface ScenePageProps {
  project: Project;
  scene: Scene;
  sceneIndex: number;
}

interface ImageHistoryItem {
  imageUrl: string;
  prompt: string;
  timestamp: string;
  metadata?: Scene['metadata'];
}

export default function ScenePage({ project, scene: initialScene, sceneIndex }: ScenePageProps) {
  const router = useRouter();
  const { csrfFetch } = useCSRF();
  const [scene, setScene] = useState<Scene>(initialScene);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New state for enhanced features
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(scene.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [compareIndex, setCompareIndex] = useState(0);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [imageWarning, setImageWarning] = useState<string | null>(null);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // Get previous and next scene IDs
  const prevScene = sceneIndex > 0 ? project.scenes[sceneIndex - 1] : null;
  const nextScene = sceneIndex < project.scenes.length - 1 ? project.scenes[sceneIndex + 1] : null;

  // Initialize image history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem(`scene_history_${scene.id}`);
    if (savedHistory) {
      try {
        setImageHistory(JSON.parse(savedHistory));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [scene.id]);

  // Save image history to localStorage
  const saveImageHistory = useCallback((newHistory: ImageHistoryItem[]) => {
    setImageHistory(newHistory);
    localStorage.setItem(`scene_history_${scene.id}`, JSON.stringify(newHistory.slice(-10))); // Keep last 10
  }, [scene.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
          setZoomLevel(1);
        } else if (showDeleteModal) {
          setShowDeleteModal(false);
        } else if (showHistory) {
          setShowHistory(false);
        } else if (showCompare) {
          setShowCompare(false);
        } else if (showKeyboardHelp) {
          setShowKeyboardHelp(false);
        } else if (showRegenerate) {
          setShowRegenerate(false);
        }
      } else if (e.key === 'ArrowLeft' && prevScene) {
        router.push(`/project/${project.id}/scene/${prevScene.id}`);
      } else if (e.key === 'ArrowRight' && nextScene) {
        router.push(`/project/${project.id}/scene/${nextScene.id}`);
      } else if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        setIsFullscreen(prev => !prev);
      } else if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        setShowRegenerate(prev => !prev);
      } else if (e.key === 'h') {
        setShowHistory(prev => !prev);
      } else if (e.key === '?') {
        setShowKeyboardHelp(true);
      } else if (e.key === '+' || e.key === '=') {
        if (isFullscreen) {
          setZoomLevel(prev => Math.min(prev + 0.25, 3));
        }
      } else if (e.key === '-') {
        if (isFullscreen) {
          setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, showDeleteModal, showHistory, showCompare, showKeyboardHelp, showRegenerate, prevScene, nextScene, project.id, router]);

  // Close download menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setShowDownloadMenu(false);
      }
    };

    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDownloadMenu]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleRegenerate = async (data: PromptData) => {
    setIsRegenerating(true);
    setError(null);
    setImageWarning(null);

    // Save current version to history before regenerating
    if (scene.imageUrl) {
      const historyItem: ImageHistoryItem = {
        imageUrl: scene.imageUrl,
        prompt: scene.prompt,
        timestamp: new Date().toISOString(),
        metadata: scene.metadata,
      };
      saveImageHistory([...imageHistory, historyItem]);
    }

    try {
      let mediaUrl: string;
      let mediaType: 'image' | 'video' = 'image';

      if (data.contentType === 'video') {
        // Generate video
        const videoResponse = await csrfFetch('/api/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: data.prompt,
            aspectRatio: data.aspectRatio === '1792x1024' ? '16:9' : data.aspectRatio === '1024x1792' ? '9:16' : '1:1',
          }),
        });

        if (!videoResponse.ok) {
          let errorMessage = `Video generation failed with status ${videoResponse.status}`;
          try {
            const errorData = await videoResponse.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // Response body is not JSON; use status-based message
          }
          throw new Error(errorMessage);
        }

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
        const imageResponse = await csrfFetch('/api/generate-image', {
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
            sceneId: scene.id,
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

      // Update scene
      const updateResponse = await fetch(`/api/scenes/${scene.id}?projectId=${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update scene');
      }

      const updatedScene = await updateResponse.json();

      // Track the generation for credits system
      trackGeneration();

      setScene(updatedScene);
      setShowRegenerate(false);
      setIsImageLoaded(false);
      setSuccessMessage('Scene regenerated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRestoreFromHistory = async (historyItem: ImageHistoryItem) => {
    try {
      const updateResponse = await fetch(`/api/scenes/${scene.id}?projectId=${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: historyItem.prompt,
          imageUrl: historyItem.imageUrl,
          metadata: historyItem.metadata,
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to restore scene');
      }

      const updatedScene = await updateResponse.json();
      setScene(updatedScene);
      setShowHistory(false);
      setIsImageLoaded(false);
      setSuccessMessage('Scene restored from history!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore scene');
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const response = await fetch(`/api/scenes/${scene.id}?projectId=${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to save notes');
      }

      const updatedScene = await response.json();
      setScene(updatedScene);
      setSuccessMessage('Notes saved!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/scenes/${scene.id}?projectId=${project.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete scene');
      }

      // Clear history from localStorage
      localStorage.removeItem(`scene_history_${scene.id}`);

      router.push(`/project/${project.id}`);
    } catch {
      setError('Failed to delete scene');
      setShowDeleteModal(false);
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

  const handleExport = (format: 'json' | 'png' | 'high') => {
    if (format === 'json') {
      window.open(`/api/export/scene/${scene.id}?projectId=${project.id}`, '_blank');
    } else if (format === 'png' && scene.imageUrl) {
      // Download the image directly
      const link = document.createElement('a');
      link.href = scene.imageUrl;
      link.download = `scene-${sceneIndex + 1}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'high' && scene.imageUrl) {
      // For high-res, we'd normally call an API endpoint
      // For now, just download the original
      const link = document.createElement('a');
      link.href = scene.imageUrl;
      link.download = `scene-${sceneIndex + 1}-highres.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setShowDownloadMenu(false);
  };

  const handleDuplicate = async () => {
    try {
      const response = await fetch(`/api/scenes?projectId=${project.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: scene.prompt,
          imageUrl: scene.imageUrl,
          metadata: scene.metadata,
          notes: scene.notes ? `${scene.notes} (copy)` : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate scene');
      }

      const newScene = await response.json();
      setSuccessMessage('Scene duplicated!');
      router.push(`/project/${project.id}/scene/${newScene.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate scene');
    }
  };

  return (
    <>
      <Head>
        <title>Scene {sceneIndex + 1} - {project.name} | HALCYON-Cinema</title>
        <meta name="description" content={scene.prompt.slice(0, 160)} />
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <Breadcrumb
            items={[
              { label: 'Projects', href: '/' },
              { label: project.name, href: `/project/${project.id}` },
              { label: `Scene ${sceneIndex + 1}` },
            ]}
          />

          {/* Scene Navigation */}
          <div className={styles.sceneNav}>
            <Link
              href={prevScene ? `/project/${project.id}/scene/${prevScene.id}` : '#'}
              className={`${styles.navArrow} ${!prevScene ? styles.navDisabled : ''}`}
              aria-disabled={!prevScene}
              onClick={e => !prevScene && e.preventDefault()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span>Previous</span>
            </Link>

            <div className={styles.sceneCounter}>
              <span className={styles.currentScene}>{sceneIndex + 1}</span>
              <span className={styles.sceneDivider}>/</span>
              <span className={styles.totalScenes}>{project.scenes.length}</span>
            </div>

            <Link
              href={nextScene ? `/project/${project.id}/scene/${nextScene.id}` : '#'}
              className={`${styles.navArrow} ${!nextScene ? styles.navDisabled : ''}`}
              aria-disabled={!nextScene}
              onClick={e => !nextScene && e.preventDefault()}
            >
              <span>Next</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </div>

          {/* Success/Error Messages */}
          {successMessage && (
            <div className={styles.successMessage}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              {successMessage}
            </div>
          )}

          <div className={styles.viewer}>
            <div
              className={styles.imageContainer}
              ref={imageContainerRef}
              onClick={() => !scene.metadata?.mediaType || scene.metadata.mediaType === 'image' ? setIsFullscreen(true) : undefined}
            >
              <div className={`${styles.imageWrapper} ${!isImageLoaded ? styles.imageLoading : ''}`}>
                {scene.metadata?.mediaType === 'video' && scene.imageUrl ? (
                  <video
                    src={scene.imageUrl}
                    className={styles.sceneVideo}
                    controls
                    playsInline
                    onLoadedData={() => setIsImageLoaded(true)}
                  />
                ) : (
                  <ImageWithFallback
                    src={scene.imageUrl}
                    alt={`Scene ${sceneIndex + 1}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 70vw"
                    priority
                    fallbackType="scene"
                    onLoad={() => setIsImageLoaded(true)}
                  />
                )}
                {!isImageLoaded && (
                  <div className={styles.loadingOverlay}>
                    <span className={styles.loadingSpinner} />
                  </div>
                )}
              </div>
              {scene.imageUrl && (
                <>
                  <div className={styles.aiBadge}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                    {scene.metadata?.mediaType === 'video' ? 'AI-Generated Video' : 'AI-Generated with DALL-E 3'}
                  </div>
                  <button
                    className={styles.expandButton}
                    onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
                    title="View fullscreen (F)"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            <div className={styles.details}>
              <div className={styles.header}>
                <h1 className={styles.title}>Scene {sceneIndex + 1}</h1>
                <div className={styles.actions}>
                  <button
                    onClick={() => setShowRegenerate(!showRegenerate)}
                    className={`btn btn-secondary ${showRegenerate ? styles.activeBtn : ''}`}
                    title="Regenerate (R)"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                    </svg>
                  </button>

                  {/* Download Menu */}
                  <div className={styles.downloadWrapper} ref={downloadMenuRef}>
                    <button
                      onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                      className="btn btn-secondary"
                      title="Download"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                    </button>
                    {showDownloadMenu && (
                      <div className={styles.downloadMenu}>
                        <button onClick={() => handleExport('png')}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                          Download PNG
                        </button>
                        <button onClick={() => handleExport('high')}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                          </svg>
                          High Resolution
                        </button>
                        <button onClick={() => handleExport('json')}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          Export JSON
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleDuplicate}
                    className="btn btn-secondary"
                    title="Duplicate Scene"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </button>

                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="btn btn-secondary"
                    title="Delete Scene"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>

                  <ShareButton
                    title={`Scene ${sceneIndex + 1} - ${project.name}`}
                    text={scene.prompt.slice(0, 200)}
                  />
                </div>
              </div>

              {/* Quick Actions */}
              <div className={styles.quickActions}>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`${styles.quickAction} ${showHistory ? styles.active : ''}`}
                  disabled={imageHistory.length === 0}
                  title={`View history (${imageHistory.length} versions)`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>History ({imageHistory.length})</span>
                </button>
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className={`${styles.quickAction} ${showNotes ? styles.active : ''}`}
                  title="Add notes"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>Notes</span>
                </button>
                <button
                  onClick={() => setShowKeyboardHelp(true)}
                  className={styles.quickAction}
                  title="Keyboard shortcuts"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                    <line x1="6" y1="8" x2="6.01" y2="8" />
                    <line x1="10" y1="8" x2="10.01" y2="8" />
                    <line x1="14" y1="8" x2="14.01" y2="8" />
                    <line x1="18" y1="8" x2="18.01" y2="8" />
                    <line x1="8" y1="12" x2="8.01" y2="12" />
                    <line x1="12" y1="12" x2="12.01" y2="12" />
                    <line x1="16" y1="12" x2="16.01" y2="12" />
                    <line x1="7" y1="16" x2="17" y2="16" />
                  </svg>
                  <span>Shortcuts</span>
                </button>
              </div>

              {/* Notes Section */}
              {showNotes && (
                <div className={styles.notesSection}>
                  <h2 className={styles.sectionTitle}>Scene Notes</h2>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this scene..."
                    className={styles.notesTextarea}
                    rows={4}
                  />
                  <button
                    onClick={handleSaveNotes}
                    className="btn btn-primary"
                    disabled={isSavingNotes}
                  >
                    {isSavingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              )}

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

          {/* Image History Panel */}
          {showHistory && imageHistory.length > 0 && (
            <div className={styles.historySection}>
              <h2 className={styles.sectionTitle}>
                Image History
                <span className={styles.historyCount}>{imageHistory.length} previous version{imageHistory.length !== 1 ? 's' : ''}</span>
              </h2>
              <div className={styles.historyGrid}>
                {imageHistory.map((item, index) => (
                  <div key={index} className={styles.historyItem}>
                    <div className={styles.historyImage}>
                      {item.metadata?.mediaType === 'video' ? (
                        <video
                          src={item.imageUrl}
                          className={styles.historyVideo}
                          muted
                          playsInline
                        />
                      ) : (
                        <ImageWithFallback
                          src={item.imageUrl}
                          alt={`Version ${index + 1}`}
                          fill
                          sizes="200px"
                          fallbackType="scene"
                        />
                      )}
                      {item.metadata?.mediaType === 'video' && (
                        <span className={styles.historyVideoBadge}>VIDEO</span>
                      )}
                      {showCompare && compareIndex === index && (
                        <div className={styles.compareOverlay}>Comparing</div>
                      )}
                    </div>
                    <div className={styles.historyMeta}>
                      <p className={styles.historyPrompt}>
                        {item.prompt.length > 60 ? `${item.prompt.slice(0, 60)}...` : item.prompt}
                      </p>
                      <p className={styles.historyTime}>{formatDate(item.timestamp)}</p>
                    </div>
                    <div className={styles.historyActions}>
                      <button
                        onClick={() => { setCompareIndex(index); setShowCompare(true); }}
                        className={styles.historyBtn}
                        title="Compare with current"
                      >
                        Compare
                      </button>
                      <button
                        onClick={() => handleRestoreFromHistory(item)}
                        className={`${styles.historyBtn} ${styles.restoreBtn}`}
                        title="Restore this version"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showRegenerate && (
            <div className={styles.regenerateSection}>
              <h2 className={styles.sectionTitle}>Regenerate Scene</h2>
              <PromptBuilder
                onSubmit={handleRegenerate}
                isLoading={isRegenerating}
                initialPrompt={scene.prompt}
              />
              {error && <p className={styles.error}>{error}</p>}
              {imageWarning && !isRegenerating && <Warning message={imageWarning} />}
            </div>
          )}
        </div>
      </main>

      {/* Fullscreen Image Viewer */}
      {isFullscreen && (
        <div className={styles.fullscreenOverlay} onClick={() => setIsFullscreen(false)}>
          <div className={styles.fullscreenControls} onClick={e => e.stopPropagation()}>
            <div className={styles.zoomControls}>
              <button
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                disabled={zoomLevel <= 0.5}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
              <span>{Math.round(zoomLevel * 100)}%</span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}
                disabled={zoomLevel >= 3}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
              <button onClick={() => setZoomLevel(1)}>Reset</button>
            </div>
            <button
              className={styles.closeFullscreen}
              onClick={() => setIsFullscreen(false)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div
            className={styles.fullscreenImageWrapper}
            onClick={e => e.stopPropagation()}
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {scene.metadata?.mediaType === 'video' && scene.imageUrl ? (
              <video
                src={scene.imageUrl}
                className={styles.fullscreenVideo}
                controls
                playsInline
                autoPlay
              />
            ) : (
              <ImageWithFallback
                src={scene.imageUrl}
                alt={`Scene ${sceneIndex + 1}`}
                fill
                sizes="100vw"
                priority
                fallbackType="scene"
              />
            )}
          </div>
          <div className={styles.fullscreenNav}>
            {prevScene && (
              <button
                className={styles.fullscreenNavBtn}
                onClick={(e) => { e.stopPropagation(); router.push(`/project/${project.id}/scene/${prevScene.id}`); }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            {nextScene && (
              <button
                className={styles.fullscreenNavBtn}
                onClick={(e) => { e.stopPropagation(); router.push(`/project/${project.id}/scene/${nextScene.id}`); }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompare && imageHistory[compareIndex] && (
        <div className={styles.modalOverlay} onClick={() => setShowCompare(false)}>
          <div className={styles.compareModal} onClick={e => e.stopPropagation()}>
            <div className={styles.compareHeader}>
              <h3>Compare Versions</h3>
              <button onClick={() => setShowCompare(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.compareGrid}>
              <div className={styles.compareItem}>
                <h4>Previous</h4>
                <div className={styles.compareImage}>
                  {imageHistory[compareIndex].metadata?.mediaType === 'video' ? (
                    <video
                      src={imageHistory[compareIndex].imageUrl}
                      className={styles.compareVideo}
                      controls
                      playsInline
                      muted
                    />
                  ) : (
                    <ImageWithFallback
                      src={imageHistory[compareIndex].imageUrl}
                      alt="Previous version"
                      fill
                      sizes="50vw"
                      fallbackType="scene"
                    />
                  )}
                </div>
                <p className={styles.comparePrompt}>{imageHistory[compareIndex].prompt}</p>
              </div>
              <div className={styles.compareDivider}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
              <div className={styles.compareItem}>
                <h4>Current</h4>
                <div className={styles.compareImage}>
                  {scene.metadata?.mediaType === 'video' && scene.imageUrl ? (
                    <video
                      src={scene.imageUrl}
                      className={styles.compareVideo}
                      controls
                      playsInline
                      muted
                    />
                  ) : (
                    <ImageWithFallback
                      src={scene.imageUrl}
                      alt="Current version"
                      fill
                      sizes="50vw"
                      fallbackType="scene"
                    />
                  )}
                </div>
                <p className={styles.comparePrompt}>{scene.prompt}</p>
              </div>
            </div>
            <div className={styles.compareActions}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowCompare(false)}
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => { handleRestoreFromHistory(imageHistory[compareIndex]); setShowCompare(false); }}
              >
                Restore Previous Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
            <h3>Delete Scene?</h3>
            <p>Are you sure you want to delete Scene {sceneIndex + 1}? This action cannot be undone and all history will be lost.</p>
            <div className={styles.modalActions}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleDelete}
                style={{ background: 'var(--color-error)' }}
              >
                Delete Scene
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardHelp && (
        <div className={styles.modalOverlay} onClick={() => setShowKeyboardHelp(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>Keyboard Shortcuts</h3>
            <div className={styles.shortcutsList}>
              <div className={styles.shortcut}>
                <kbd>←</kbd>
                <span>Previous scene</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>→</kbd>
                <span>Next scene</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>F</kbd>
                <span>Fullscreen view</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>R</kbd>
                <span>Toggle regenerate</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>H</kbd>
                <span>Toggle history</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>+</kbd>
                <span>Zoom in (fullscreen)</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>-</kbd>
                <span>Zoom out (fullscreen)</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>Esc</kbd>
                <span>Close modal/fullscreen</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>?</kbd>
                <span>Show this help</span>
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setShowKeyboardHelp(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ScenePageProps> = async (context) => {
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
  const sceneId = context.params?.sceneId as string;

  try {
    const project = await getProjectByIdAsync(projectId);
    if (!project) {
      return { notFound: true };
    }

    // Verify user owns this project (strict check - projects must have userId)
    if (project.userId !== session.user.id) {
      return { notFound: true };
    }

    const scene = await getSceneByIdAsync(projectId, sceneId);
    if (!scene) {
      return { notFound: true };
    }

    const sceneIndex = project.scenes.findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) {
      return { notFound: true };
    }

    return {
      props: {
        project,
        scene,
        sceneIndex,
      },
    };
  } catch (error) {
    console.error('Failed to load scene:', error);
    return { notFound: true };
  }
};

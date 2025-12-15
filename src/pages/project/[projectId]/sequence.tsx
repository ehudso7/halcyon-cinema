import { useState, useEffect, useMemo, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import Breadcrumb from '@/components/Breadcrumb';
import ProjectNavigation from '@/components/ProjectNavigation';
import SceneSequencer from '@/components/SceneSequencer';
import VoiceoverPanel from '@/components/VoiceoverPanel';
import MusicPanel from '@/components/MusicPanel';
import { useToast } from '@/components/Toast';
import { Project, ShotBlock } from '@/types';
import { getProjectByIdAsync } from '@/utils/storage';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import styles from '@/styles/Sequence.module.css';

interface SequencePageProps {
  project: Project;
}

export default function SequencePage({ project: initialProject }: SequencePageProps) {
  const [project, setProject] = useState(initialProject);
  const [voiceoverText, setVoiceoverText] = useState('');
  const [showVoiceover, setShowVoiceover] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [musicPrompt, setMusicPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(true);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentShots, setCurrentShots] = useState<ShotBlock[]>(() => {
    if (project.sequences?.[0]?.shots) {
      return project.sequences[0].shots;
    }
    return project.scenes.map((scene, index) => ({
      sceneId: scene.id,
      order: index,
      title: `Scene ${index + 1}`,
      duration: 5,
      transitionType: 'cut' as const,
    }));
  });
  const { showSuccess, showError } = useToast();

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Playback preview
  useEffect(() => {
    if (isPlaying && previewMode && currentShots.length > 0) {
      const currentShot = currentShots[currentPreviewIndex];
      const duration = (currentShot?.duration || 5) * 1000;

      const timer = setTimeout(() => {
        if (currentPreviewIndex < currentShots.length - 1) {
          setCurrentPreviewIndex(prev => prev + 1);
        } else {
          setIsPlaying(false);
          setCurrentPreviewIndex(0);
        }
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isPlaying, currentPreviewIndex, currentShots, previewMode]);

  const handleSaveSequence = useCallback(async (shots: ShotBlock[]) => {
    setIsSaving(true);
    setCurrentShots(shots);

    try {
      const existingSequence = project.sequences?.[0];

      if (existingSequence) {
        const response = await fetch(`/api/projects/${project.id}/sequences/${existingSequence.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: existingSequence.name,
            shots,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save sequence');
        }

        const updatedSequence = await response.json();
        setProject(prev => ({
          ...prev,
          sequences: [updatedSequence],
        }));
      } else {
        const response = await fetch(`/api/projects/${project.id}/sequences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Main Sequence',
            description: `Scene flow for ${project.name}`,
            shots,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save sequence');
        }

        const newSequence = await response.json();
        setProject(prev => ({
          ...prev,
          sequences: [newSequence],
        }));
      }

      showSuccess('Sequence saved successfully!');
      setSuccessMessage('Sequence saved successfully!');
    } catch (error) {
      console.error('Error saving sequence:', error);
      showError(error instanceof Error ? error.message : 'Failed to save sequence');
    } finally {
      setIsSaving(false);
    }
  }, [project.id, project.name, project.sequences, showSuccess, showError]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalDuration = currentShots.reduce((sum, shot) => sum + (shot.duration || 0), 0);
    const avgDuration = currentShots.length > 0 ? totalDuration / currentShots.length : 0;
    const transitionCounts: Record<string, number> = {};
    currentShots.forEach(shot => {
      const t = shot.transitionType || 'cut';
      transitionCounts[t] = (transitionCounts[t] || 0) + 1;
    });

    return {
      totalShots: currentShots.length,
      totalDuration,
      avgDuration: Math.round(avgDuration * 10) / 10,
      unusedScenes: project.scenes.length - currentShots.length,
      transitionCounts,
    };
  }, [currentShots, project.scenes.length]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const handleExportScript = (shots: ShotBlock[], format: 'markdown' | 'json' | 'txt' = 'markdown') => {
    // Calculate total duration from the shots being exported for consistency
    const exportTotalDuration = shots.reduce((sum, shot) => sum + (shot.duration || 0), 0);

    if (format === 'json') {
      const exportData = {
        projectName: project.name,
        exportedAt: new Date().toISOString(),
        totalDuration: exportTotalDuration,
        shots: shots.map((shot, index) => {
          const scene = project.scenes.find(s => s.id === shot.sceneId);
          return {
            order: index + 1,
            title: shot.title || `Scene ${index + 1}`,
            duration: shot.duration,
            transition: shot.transitionType,
            prompt: scene?.prompt,
            imageUrl: scene?.imageUrl,
          };
        }),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}_sequence.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'txt') {
      let script = `${project.name.toUpperCase()}\n`;
      script += `${'='.repeat(project.name.length)}\n\n`;
      script += `Scene Sequence - ${shots.length} shots\n`;
      script += `Total Runtime: ${formatDuration(exportTotalDuration)}\n\n`;
      script += `----------------------------------------\n\n`;

      shots.forEach((shot, index) => {
        const scene = project.scenes.find(s => s.id === shot.sceneId);
        if (scene) {
          script += `SCENE ${index + 1}: ${shot.title || `Scene ${index + 1}`}\n`;
          script += `Duration: ${shot.duration}s | Transition: ${shot.transitionType?.toUpperCase() || 'CUT'}\n\n`;
          script += `${scene.prompt}\n\n`;
          script += `----------------------------------------\n\n`;
        }
      });

      const blob = new Blob([script], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}_script.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      let script = `# ${project.name}\n\n`;
      script += `## Scene Sequence\n\n`;
      script += `**Total Shots:** ${shots.length}\n`;
      script += `**Total Runtime:** ${formatDuration(exportTotalDuration)}\n\n`;
      script += `---\n\n`;

      shots.forEach((shot, index) => {
        const scene = project.scenes.find(s => s.id === shot.sceneId);
        if (scene) {
          script += `### ${shot.title || `Scene ${index + 1}`}\n\n`;
          script += `**Duration:** ${shot.duration}s\n`;
          script += `**Transition:** ${shot.transitionType?.toUpperCase() || 'CUT'}\n\n`;
          script += `${scene.prompt}\n\n`;
          script += `---\n\n`;
        }
      });

      const blob = new Blob([script], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}_script.md`;
      a.click();
      URL.revokeObjectURL(url);
    }

    setSuccessMessage(`Script exported as ${format.toUpperCase()}`);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSaveSequence(currentShots);
      } else if (e.key === 'p' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setPreviewMode(prev => !prev);
      } else if (e.key === ' ' && previewMode) {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.key === 'v' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowVoiceover(prev => !prev);
      } else if (e.key === 't' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowStatsPanel(prev => !prev);
      } else if (e.key === 'Escape') {
        if (previewMode) {
          setPreviewMode(false);
          setIsPlaying(false);
        }
        setShowShortcutsModal(false);
      } else if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal(true);
      } else if (e.key === 'ArrowLeft' && previewMode) {
        e.preventDefault();
        setCurrentPreviewIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight' && previewMode) {
        e.preventDefault();
        setCurrentPreviewIndex(prev => Math.min(currentShots.length - 1, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentShots, previewMode, handleSaveSequence]);

  // Generate default narration text from scenes
  useEffect(() => {
    if (project.scenes.length > 0) {
      const narration = project.scenes
        .map((scene, i) => `Scene ${i + 1}: ${scene.prompt.slice(0, 100)}...`)
        .join('\n\n');
      setVoiceoverText(narration);
    }
  }, [project.scenes]);

  return (
    <>
      <Head>
        <title>Scene Flow | {project.name} | HALCYON-Cinema</title>
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <Breadcrumb
            items={[
              { label: 'Projects', href: '/' },
              { label: project.name, href: `/project/${project.id}` },
              { label: 'Scene Flow' },
            ]}
          />

          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>Scene Flow</h1>
                <button
                  className={styles.statsButton}
                  onClick={() => setShowStatsPanel(!showStatsPanel)}
                  title="Toggle statistics (T)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 20V10M12 20V4M6 20v-6" />
                  </svg>
                </button>
              </div>
              <p className={styles.meta}>
                <span className={styles.sceneCount}>{project.scenes.length}</span> {project.scenes.length === 1 ? 'scene' : 'scenes'} in <span className={styles.projectName}>{project.name}</span>
              </p>
            </div>
            <div className={styles.headerActions}>
              {project.scenes.length > 0 && (
                <>
                  <button
                    className={`btn btn-secondary ${previewMode ? styles.activeBtn : ''}`}
                    onClick={() => setPreviewMode(!previewMode)}
                    title="Preview mode (P)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    {previewMode ? 'Exit Preview' : 'Preview'}
                  </button>
                  <div className={styles.exportMenu}>
                    <button className="btn btn-secondary" title="Export options">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Export
                    </button>
                    <div className={styles.exportDropdown}>
                      <button onClick={() => handleExportScript(currentShots, 'markdown')}>
                        Markdown (.md)
                      </button>
                      <button onClick={() => handleExportScript(currentShots, 'json')}>
                        JSON Data (.json)
                      </button>
                      <button onClick={() => handleExportScript(currentShots, 'txt')}>
                        Plain Text (.txt)
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <ProjectNavigation projectId={project.id} activeTab="sequence" />

          {/* Success Message */}
          {successMessage && (
            <div className={styles.successMessage}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              {successMessage}
            </div>
          )}

          {/* Statistics Panel */}
          {showStatsPanel && project.scenes.length > 0 && (
            <div className={styles.statsPanel}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.totalShots}</span>
                <span className={styles.statLabel}>Shots</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{formatDuration(stats.totalDuration)}</span>
                <span className={styles.statLabel}>Total Duration</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.avgDuration}s</span>
                <span className={styles.statLabel}>Avg per Shot</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.unusedScenes}</span>
                <span className={styles.statLabel}>Unused Scenes</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.transitionCounts.cut || 0}</span>
                <span className={styles.statLabel}>Cuts</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.transitionCounts.fade || 0}</span>
                <span className={styles.statLabel}>Fades</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{(stats.transitionCounts.dissolve || 0) + (stats.transitionCounts.wipe || 0)}</span>
                <span className={styles.statLabel}>Other</span>
              </div>
            </div>
          )}

          {/* Preview Mode */}
          {previewMode && currentShots.length > 0 && (
            <div className={styles.previewPanel}>
              <div className={styles.previewHeader}>
                <h3>Preview Mode</h3>
                <div className={styles.previewControls}>
                  <button
                    className={styles.previewBtn}
                    onClick={() => setCurrentPreviewIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentPreviewIndex === 0}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <button
                    className={`${styles.previewBtn} ${styles.playBtn}`}
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                  </button>
                  <button
                    className={styles.previewBtn}
                    onClick={() => setCurrentPreviewIndex(prev => Math.min(currentShots.length - 1, prev + 1))}
                    disabled={currentPreviewIndex === currentShots.length - 1}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
                <span className={styles.previewCounter}>
                  {currentPreviewIndex + 1} / {currentShots.length}
                </span>
              </div>
              <div className={styles.previewContent}>
                {(() => {
                  const shot = currentShots[currentPreviewIndex];
                  const scene = project.scenes.find(s => s.id === shot?.sceneId);
                  if (!scene) return null;
                  return (
                    <>
                      <div className={styles.previewImage}>
                        {scene.imageUrl ? (
                          <Image src={scene.imageUrl} alt={shot.title || 'Scene'} fill unoptimized style={{ objectFit: 'cover' }} />
                        ) : (
                          <div className={styles.previewPlaceholder}>
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                          </div>
                        )}
                        <div className={styles.previewTransition}>
                          {shot.transitionType?.toUpperCase() || 'CUT'}
                        </div>
                      </div>
                      <div className={styles.previewInfo}>
                        <h4>{shot.title || `Scene ${currentPreviewIndex + 1}`}</h4>
                        <p>{scene.prompt}</p>
                        <div className={styles.previewMeta}>
                          <span>Duration: {shot.duration}s</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className={styles.previewTimeline}>
                {currentShots.map((shot, index) => {
                  const scene = project.scenes.find(s => s.id === shot.sceneId);
                  return (
                    <button
                      key={shot.sceneId}
                      className={`${styles.timelineThumb} ${index === currentPreviewIndex ? styles.active : ''}`}
                      onClick={() => setCurrentPreviewIndex(index)}
                    >
                      {scene?.imageUrl ? (
                        <Image src={scene.imageUrl} alt="" fill unoptimized style={{ objectFit: 'cover' }} />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {project.scenes.length > 0 ? (
            <div className={styles.content}>
              <SceneSequencer
                scenes={project.scenes}
                initialOrder={project.sequences?.[0]?.shots}
                onSave={handleSaveSequence}
                onExport={(shots) => handleExportScript(shots, 'markdown')}
                isSaving={isSaving}
              />

              <div className={styles.audioSections}>
                <div className={styles.voiceoverSection}>
                  <button
                    className={`${styles.voiceoverToggle} ${showVoiceover ? styles.active : ''}`}
                    onClick={() => setShowVoiceover(!showVoiceover)}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                      <path d="M19 10v2a7 7 0 01-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                    {showVoiceover ? 'Hide Voiceover Panel' : 'Add Voiceover'}
                  </button>

                  {showVoiceover && (
                    <VoiceoverPanel
                      text={voiceoverText}
                      onTextChange={setVoiceoverText}
                      sceneTitle="Full Sequence"
                    />
                  )}
                </div>

                <div className={styles.musicSection}>
                  <button
                    className={`${styles.musicToggle} ${showMusic ? styles.active : ''}`}
                    onClick={() => setShowMusic(!showMusic)}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                    {showMusic ? 'Hide Music Panel' : 'Add Background Music'}
                  </button>

                  {showMusic && (
                    <MusicPanel
                      initialPrompt={musicPrompt}
                      sceneTitle="Full Sequence"
                      projectId={project.id}
                      onMusicGenerated={(audioUrl) => {
                        console.log('Music generated:', audioUrl);
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
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
              <h3>No scenes to sequence</h3>
              <p>Create some scenes first, then arrange them into your narrative flow.</p>
              <Link href={`/project/${project.id}`} className="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Go to Scenes
              </Link>
            </div>
          )}

          {/* Keyboard shortcut hint */}
          <div className={styles.shortcutHint}>
            Press <kbd>?</kbd> for keyboard shortcuts
          </div>
        </div>
      </main>

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowShortcutsModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>Keyboard Shortcuts</h3>
            <div className={styles.shortcutsList}>
              <div className={styles.shortcut}>
                <kbd>Ctrl+S</kbd>
                <span>Save sequence</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>P</kbd>
                <span>Toggle preview mode</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>Space</kbd>
                <span>Play/pause preview</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>Left/Right</kbd>
                <span>Navigate shots in preview</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>V</kbd>
                <span>Toggle voiceover panel</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>T</kbd>
                <span>Toggle statistics</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>Esc</kbd>
                <span>Exit preview / Close modals</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>?</kbd>
                <span>Show shortcuts</span>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className="btn btn-primary" onClick={() => setShowShortcutsModal(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const getServerSideProps: GetServerSideProps<SequencePageProps> = async (context) => {
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

    return {
      props: { project },
    };
  } catch (error) {
    console.error('Failed to load project:', error);
    return { notFound: true };
  }
};

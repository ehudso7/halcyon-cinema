import { useState, useEffect, useMemo, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import Head from 'next/head';
import Header from '@/components/Header';
import Breadcrumb from '@/components/Breadcrumb';
import ProjectNavigation from '@/components/ProjectNavigation';
import CharacterManager from '@/components/CharacterManager';
import { Project, Character } from '@/types';
import { getProjectByIdAsync } from '@/utils/storage';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import styles from '@/styles/Characters.module.css';

interface CharactersPageProps {
  project: Project;
}

type SortBy = 'name' | 'recent' | 'appearances';
type ViewMode = 'grid' | 'list';

export default function CharactersPage({ project: initialProject }: CharactersPageProps) {
  const [project, setProject] = useState<Project>(initialProject);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Enhanced state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [isAddingCharacter, setIsAddingCharacter] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);

  // Filter and sort characters (defined before useEffect for keyboard shortcuts)
  const filteredCharacters = useMemo(() => {
    let filtered = project.characters || [];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.traits.some(t => t.toLowerCase().includes(query))
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'appearances':
          return b.appearances.length - a.appearances.length;
        case 'recent':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
  }, [project.characters, searchQuery, sortBy]);

  // Load view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('characters_view_mode');
    if (savedViewMode === 'grid' || savedViewMode === 'list') {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view mode to localStorage
  useEffect(() => {
    localStorage.setItem('characters_view_mode', viewMode);
  }, [viewMode]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        if (showDeleteModal) {
          setShowDeleteModal(false);
          setCharacterToDelete(null);
        } else if (showBulkDeleteModal) {
          setShowBulkDeleteModal(false);
        } else if (showKeyboardHelp) {
          setShowKeyboardHelp(false);
        } else if (selectedCharacters.size > 0) {
          setSelectedCharacters(new Set());
        }
      } else if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        setIsAddingCharacter(true);
      } else if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        setViewMode('grid');
      } else if (e.key === 'l' && !e.ctrlKey && !e.metaKey) {
        setViewMode('list');
      } else if (e.key === '?') {
        setShowKeyboardHelp(true);
      } else if (e.key === 'a' && (e.ctrlKey || e.metaKey) && filteredCharacters.length > 0) {
        e.preventDefault();
        if (selectedCharacters.size === filteredCharacters.length) {
          setSelectedCharacters(new Set());
        } else {
          setSelectedCharacters(new Set(filteredCharacters.map(c => c.id)));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteModal, showBulkDeleteModal, showKeyboardHelp, selectedCharacters, filteredCharacters]);

  const clearError = () => setError(null);

  // Statistics
  const stats = useMemo(() => {
    const characters = project.characters || [];
    const totalAppearances = characters.reduce((sum, c) => sum + c.appearances.length, 0);
    const avgAppearances = characters.length > 0 ? (totalAppearances / characters.length).toFixed(1) : '0';
    const withImages = characters.filter(c => c.imageUrl).length;
    const avgTraits = characters.length > 0
      ? (characters.reduce((sum, c) => sum + c.traits.length, 0) / characters.length).toFixed(1)
      : '0';

    return {
      total: characters.length,
      totalAppearances,
      avgAppearances,
      withImages,
      avgTraits,
    };
  }, [project.characters]);

  const handleAddCharacter = async (characterData: Omit<Character, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'appearances'>) => {
    clearError();
    try {
      const response = await fetch(`/api/projects/${project.id}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(characterData),
      });

      if (response.ok) {
        const newCharacter = await response.json();
        setProject(prev => ({
          ...prev,
          characters: [...(prev.characters || []), newCharacter],
        }));
        setSuccessMessage('Character created successfully!');
        setIsAddingCharacter(false);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add character');
      }
    } catch (err) {
      console.error('Error adding character:', err);
      setError('Failed to add character. Please try again.');
    }
  };

  const handleUpdateCharacter = async (id: string, updates: Partial<Character>) => {
    clearError();
    try {
      const response = await fetch(`/api/projects/${project.id}/characters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedCharacter = await response.json();
        setProject(prev => ({
          ...prev,
          characters: prev.characters?.map(c => c.id === id ? updatedCharacter : c) || [],
        }));
        setSuccessMessage('Character updated successfully!');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update character');
      }
    } catch (err) {
      console.error('Error updating character:', err);
      setError('Failed to update character. Please try again.');
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    clearError();
    try {
      const response = await fetch(`/api/projects/${project.id}/characters/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setProject(prev => ({
          ...prev,
          characters: prev.characters?.filter(c => c.id !== id) || [],
        }));
        setSelectedCharacters(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setSuccessMessage('Character deleted successfully!');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete character');
      }
    } catch (err) {
      console.error('Error deleting character:', err);
      setError('Failed to delete character. Please try again.');
    }
    setShowDeleteModal(false);
    setCharacterToDelete(null);
  };

  const handleBulkDelete = async () => {
    clearError();
    const ids = Array.from(selectedCharacters);
    let successCount = 0;
    let errorCount = 0;

    for (const id of ids) {
      try {
        const response = await fetch(`/api/projects/${project.id}/characters/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    setProject(prev => ({
      ...prev,
      characters: prev.characters?.filter(c => !selectedCharacters.has(c.id)) || [],
    }));
    setSelectedCharacters(new Set());
    setShowBulkDeleteModal(false);

    if (errorCount > 0) {
      setError(`Deleted ${successCount} characters. ${errorCount} failed.`);
    } else {
      setSuccessMessage(`Deleted ${successCount} character${successCount !== 1 ? 's' : ''} successfully!`);
    }
  };

  const confirmDelete = (character: Character) => {
    setCharacterToDelete(character);
    setShowDeleteModal(true);
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedCharacters(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = () => {
    if (selectedCharacters.size === filteredCharacters.length) {
      setSelectedCharacters(new Set());
    } else {
      setSelectedCharacters(new Set(filteredCharacters.map(c => c.id)));
    }
  };

  return (
    <>
      <Head>
        <title>Characters | {project.name} | HALCYON-Cinema</title>
        <meta name="description" content={`Manage characters for ${project.name}`} />
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <Breadcrumb
            items={[
              { label: 'Projects', href: '/' },
              { label: project.name, href: `/project/${project.id}` },
              { label: 'Characters' },
            ]}
          />

          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>{project.name}</h1>
                <button
                  className={styles.statsButton}
                  onClick={() => setShowStatsPanel(!showStatsPanel)}
                  title="View statistics"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </button>
              </div>
              <p className={styles.meta}>
                <span className={styles.characterCount}>{project.characters?.length || 0}</span> character{(project.characters?.length || 0) !== 1 ? 's' : ''}
                {project.scenes?.length > 0 && (
                  <span className={styles.scenesInfo}> • {project.scenes.length} scene{project.scenes.length !== 1 ? 's' : ''}</span>
                )}
              </p>
            </div>
            <div className={styles.headerActions}>
              <button
                onClick={() => setShowKeyboardHelp(true)}
                className="btn btn-secondary"
                title="Keyboard shortcuts"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              </button>
            </div>
          </div>

          {/* Statistics Panel */}
          {showStatsPanel && (
            <div className={styles.statsPanel}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.total}</span>
                <span className={styles.statLabel}>Total Characters</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.totalAppearances}</span>
                <span className={styles.statLabel}>Scene Appearances</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.avgAppearances}</span>
                <span className={styles.statLabel}>Avg. Appearances</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.withImages}</span>
                <span className={styles.statLabel}>With Images</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.avgTraits}</span>
                <span className={styles.statLabel}>Avg. Traits</span>
              </div>
            </div>
          )}

          <ProjectNavigation projectId={project.id} activeTab="characters" />

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

          {error && (
            <div className={styles.errorBanner}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
              <button onClick={clearError} className={styles.dismissBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* Controls */}
          <div className={styles.controls}>
            <div className={styles.searchRow}>
              <div className={styles.searchWrapper}>
                <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search characters..."
                  className={styles.searchInput}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className={styles.clearSearch}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              <div className={styles.sortSelect}>
                <label htmlFor="sortBy">Sort:</label>
                <select
                  id="sortBy"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                >
                  <option value="recent">Recently Updated</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="appearances">Most Appearances</option>
                </select>
              </div>

              <div className={styles.viewToggle}>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
                  title="Grid view"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
                  title="List view"
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

            {/* Bulk Actions */}
            {selectedCharacters.size > 0 && (
              <div className={styles.bulkActions}>
                <span className={styles.selectedCount}>
                  {selectedCharacters.size} selected
                </span>
                <button onClick={selectAll} className={styles.selectAllBtn}>
                  {selectedCharacters.size === filteredCharacters.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={() => setShowBulkDeleteModal(true)}
                  className={`btn btn-secondary ${styles.bulkDeleteBtn}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Delete Selected
                </button>
              </div>
            )}
          </div>

          <CharacterManager
            characters={filteredCharacters}
            onAddCharacter={handleAddCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onDeleteCharacter={confirmDelete}
            viewMode={viewMode}
            selectedCharacters={selectedCharacters}
            onToggleSelect={toggleSelect}
            isAddingCharacter={isAddingCharacter}
            setIsAddingCharacter={setIsAddingCharacter}
            scenes={project.scenes}
          />
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && characterToDelete && (
        <div className={styles.modalOverlay} onClick={() => { setShowDeleteModal(false); setCharacterToDelete(null); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
            <h3>Delete Character?</h3>
            <p>Are you sure you want to delete <strong>{characterToDelete.name}</strong>? This will remove them from all scene associations.</p>
            <div className={styles.modalActions}>
              <button
                className="btn btn-secondary"
                onClick={() => { setShowDeleteModal(false); setCharacterToDelete(null); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleDeleteCharacter(characterToDelete.id)}
                style={{ background: 'var(--color-error)' }}
              >
                Delete Character
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
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </div>
            <h3>Delete {selectedCharacters.size} Characters?</h3>
            <p>Are you sure you want to delete {selectedCharacters.size} selected character{selectedCharacters.size !== 1 ? 's' : ''}? This action cannot be undone.</p>
            <div className={styles.modalActions}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowBulkDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleBulkDelete}
                style={{ background: 'var(--color-error)' }}
              >
                Delete All
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
                <kbd>N</kbd>
                <span>New character</span>
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
                <span>Select/Deselect all</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>Esc</kbd>
                <span>Clear selection/Close modal</span>
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

export const getServerSideProps: GetServerSideProps<CharactersPageProps> = async (context) => {
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

    // Verify user owns this project (strict check - projects must have userId)
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

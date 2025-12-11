import { useState, useEffect, useCallback, useMemo } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import Head from 'next/head';
import Header from '@/components/Header';
import Breadcrumb from '@/components/Breadcrumb';
import ProjectNavigation from '@/components/ProjectNavigation';
import LoreCard from '@/components/LoreCard';
import AddLoreModal from '@/components/AddLoreModal';
import { LoreEntry, LoreType, Project } from '@/types';
import { getProjectByIdAsync, getProjectLoreAsync } from '@/utils/storage';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import styles from '@/styles/Lore.module.css';

const LORE_FILTER_TABS: { type: LoreType | 'all'; label: string; icon: string }[] = [
  { type: 'all', label: 'All', icon: '📚' },
  { type: 'character', label: 'Characters', icon: '👤' },
  { type: 'location', label: 'Locations', icon: '🏛️' },
  { type: 'event', label: 'Events', icon: '📅' },
  { type: 'system', label: 'Systems', icon: '⚙️' },
];

type SortBy = 'name' | 'type' | 'recent' | 'scenes';
type ViewMode = 'grid' | 'list';

interface LorePageProps {
  project: Project;
  initialEntries: LoreEntry[];
}

export default function LoreDashboard({ project, initialEntries }: LorePageProps) {
  const [entries, setEntries] = useState<LoreEntry[]>(initialEntries);
  const [activeTab, setActiveTab] = useState<LoreType | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<LoreEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New state for enhanced functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<LoreEntry | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<LoreEntry | null>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Load view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('loreViewMode') as ViewMode;
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view mode to localStorage
  useEffect(() => {
    localStorage.setItem('loreViewMode', viewMode);
  }, [viewMode]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const clearError = () => setError(null);

  const fetchLore = async () => {
    clearError();
    try {
      const response = await fetch(`/api/projects/${project.id}/lore`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to load lore entries');
      }
    } catch (err) {
      console.error('Error fetching lore:', err);
      setError('Failed to load lore entries. Please try again.');
    }
  };

  const handleSave = async (entry: Omit<LoreEntry, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>) => {
    clearError();
    try {
      if (editEntry) {
        const response = await fetch(`/api/projects/${project.id}/lore/${editEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (response.ok) {
          fetchLore();
          setSuccessMessage(`"${entry.name}" updated successfully`);
        } else {
          const data = await response.json();
          setError(data.error || 'Failed to update lore entry');
        }
      } else {
        const response = await fetch(`/api/projects/${project.id}/lore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (response.ok) {
          fetchLore();
          setSuccessMessage(`"${entry.name}" created successfully`);
        } else {
          const data = await response.json();
          setError(data.error || 'Failed to create lore entry');
        }
      }
    } catch (err) {
      console.error('Error saving lore:', err);
      setError('Failed to save lore entry. Please try again.');
    }
    setEditEntry(null);
  };

  const handleDelete = async (entry: LoreEntry) => {
    clearError();
    try {
      const response = await fetch(`/api/projects/${project.id}/lore/${entry.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setEntries(prev => prev.filter(e => e.id !== entry.id));
        setSuccessMessage(`"${entry.name}" deleted`);
        setSelectedEntries(prev => {
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        });
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete lore entry');
      }
    } catch (err) {
      console.error('Error deleting lore:', err);
      setError('Failed to delete lore entry. Please try again.');
    }
    setShowDeleteModal(null);
  };

  const handleBulkDelete = async () => {
    clearError();
    const idsToDelete = Array.from(selectedEntries);
    let deletedCount = 0;

    for (const id of idsToDelete) {
      try {
        const response = await fetch(`/api/projects/${project.id}/lore/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          deletedCount++;
        }
      } catch (err) {
        console.error('Error deleting lore:', err);
      }
    }

    if (deletedCount > 0) {
      setEntries(prev => prev.filter(e => !selectedEntries.has(e.id)));
      setSelectedEntries(new Set());
      setSuccessMessage(`${deletedCount} ${deletedCount === 1 ? 'entry' : 'entries'} deleted`);
    }
    setShowBulkDeleteModal(false);
  };

  const handleEdit = (entry: LoreEntry) => {
    setEditEntry(entry);
    setShowModal(true);
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Filter and sort entries - declared before selectAll since it depends on this
  const filteredAndSortedEntries = useMemo(() => {
    let result = [...entries];

    // Filter by tab
    if (activeTab !== 'all') {
      result = result.filter(e => e.type === activeTab);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(query) ||
        e.summary.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        e.tags?.some(t => t.toLowerCase().includes(query))
      );
    }

    // Sort
    switch (sortBy) {
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'type':
        result.sort((a, b) => a.type.localeCompare(b.type));
        break;
      case 'scenes':
        result.sort((a, b) => (b.associatedScenes?.length || 0) - (a.associatedScenes?.length || 0));
        break;
      case 'recent':
      default:
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
    }

    return result;
  }, [entries, activeTab, searchQuery, sortBy]);

  // Select all - declared after filteredAndSortedEntries since it depends on it
  const selectAll = useCallback(() => {
    const filteredIds = filteredAndSortedEntries.map(e => e.id);
    setSelectedEntries(prev => {
      const allSelected = filteredIds.every(id => prev.has(id));
      if (allSelected) {
        return new Set();
      } else {
        return new Set(filteredIds);
      }
    });
  }, [filteredAndSortedEntries]);

  // Statistics
  const stats = useMemo(() => {
    const totalSceneLinks = entries.reduce((sum, e) => sum + (e.associatedScenes?.length || 0), 0);
    const totalTags = new Set(entries.flatMap(e => e.tags || [])).size;

    return {
      total: entries.length,
      characters: entries.filter(e => e.type === 'character').length,
      locations: entries.filter(e => e.type === 'location').length,
      events: entries.filter(e => e.type === 'event').length,
      systems: entries.filter(e => e.type === 'system').length,
      sceneLinks: totalSceneLinks,
      uniqueTags: totalTags,
    };
  }, [entries]);

  // Get counts for tabs
  const getCounts = () => {
    const counts: Record<string, number> = { all: entries.length };
    LORE_FILTER_TABS.slice(1).forEach(tab => {
      counts[tab.type] = entries.filter(e => e.type === tab.type).length;
    });
    return counts;
  };

  const counts = getCounts();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setEditEntry(null);
        setShowModal(true);
      } else if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setViewMode('grid');
      } else if (e.key === 'l' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setViewMode('list');
      } else if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowStatsPanel(prev => !prev);
      } else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        selectAll();
      } else if (e.key === 'Escape') {
        setSelectedEntries(new Set());
        setShowDeleteModal(null);
        setShowBulkDeleteModal(false);
        setShowDetailModal(null);
        setShowShortcutsModal(false);
      } else if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal(true);
      } else if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('loreSearch');
        searchInput?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAll]);

  // Export lore data
  const handleExport = () => {
    const exportData = {
      projectName: project.name,
      exportedAt: new Date().toISOString(),
      loreEntries: entries.map(e => ({
        name: e.name,
        type: e.type,
        summary: e.summary,
        description: e.description,
        tags: e.tags,
        sceneCount: e.associatedScenes?.length || 0,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_lore.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccessMessage('Lore exported successfully');
  };

  return (
    <>
      <Head>
        <title>World Lore | {project.name} | HALCYON-Cinema</title>
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <Breadcrumb
            items={[
              { label: 'Projects', href: '/' },
              { label: project.name, href: `/project/${project.id}` },
              { label: 'World Lore' },
            ]}
          />

          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>World Lore</h1>
                <button
                  className={styles.statsButton}
                  onClick={() => setShowStatsPanel(!showStatsPanel)}
                  title="Toggle statistics (S)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 20V10M12 20V4M6 20v-6" />
                  </svg>
                </button>
              </div>
              <p className={styles.meta}>
                <span className={styles.entryCount}>{entries.length}</span> lore {entries.length === 1 ? 'entry' : 'entries'} in <span className={styles.projectName}>{project.name}</span>
              </p>
            </div>
            <div className={styles.headerActions}>
              <button className="btn btn-secondary" onClick={handleExport} title="Export lore data">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Export
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditEntry(null);
                  setShowModal(true);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Lore
              </button>
            </div>
          </div>

          <ProjectNavigation projectId={project.id} activeTab="lore" />

          {/* Statistics Panel */}
          {showStatsPanel && (
            <div className={styles.statsPanel}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.total}</span>
                <span className={styles.statLabel}>Total Entries</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.characters}</span>
                <span className={styles.statLabel}>Characters</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.locations}</span>
                <span className={styles.statLabel}>Locations</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.events}</span>
                <span className={styles.statLabel}>Events</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.systems}</span>
                <span className={styles.statLabel}>Systems</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.sceneLinks}</span>
                <span className={styles.statLabel}>Scene Links</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{stats.uniqueTags}</span>
                <span className={styles.statLabel}>Unique Tags</span>
              </div>
            </div>
          )}

          {/* Success/Error Messages */}
          {successMessage && (
            <div className={styles.successMessage}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              {successMessage}
            </div>
          )}

          {error && (
            <div className={styles.errorBanner}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
              <button className={styles.dismissBtn} onClick={clearError}>
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
                  id="loreSearch"
                  type="text"
                  placeholder="Search lore by name, summary, description, or tags... (/)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
                {searchQuery && (
                  <button className={styles.clearSearch} onClick={() => setSearchQuery('')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              <div className={styles.sortSelect}>
                <label>Sort:</label>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}>
                  <option value="recent">Most Recent</option>
                  <option value="name">Name</option>
                  <option value="type">Type</option>
                  <option value="scenes">Scene Links</option>
                </select>
              </div>

              <div className={styles.viewToggle}>
                <button
                  className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid view (G)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </button>
                <button
                  className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
                  onClick={() => setViewMode('list')}
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

            {/* Bulk Actions */}
            {selectedEntries.size > 0 && (
              <div className={styles.bulkActions}>
                <span className={styles.selectedCount}>
                  {selectedEntries.size} selected
                </span>
                <button className={styles.selectAllBtn} onClick={selectAll}>
                  {selectedEntries.size === filteredAndSortedEntries.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  className={`btn btn-secondary ${styles.bulkDeleteBtn}`}
                  onClick={() => setShowBulkDeleteModal(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Delete Selected
                </button>
              </div>
            )}
          </div>

          {/* Filter Tabs */}
          <div className={styles.tabs}>
            {LORE_FILTER_TABS.map(tab => (
              <button
                key={tab.type}
                className={`${styles.tab} ${activeTab === tab.type ? styles.active : ''}`}
                onClick={() => setActiveTab(tab.type)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={styles.count}>{counts[tab.type]}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          {filteredAndSortedEntries.length > 0 ? (
            <div className={viewMode === 'grid' ? styles.grid : styles.list}>
              {filteredAndSortedEntries.map(entry => (
                <LoreCard
                  key={entry.id}
                  entry={entry}
                  viewMode={viewMode}
                  isSelected={selectedEntries.has(entry.id)}
                  onSelect={() => toggleSelect(entry.id)}
                  onEdit={handleEdit}
                  onDelete={() => setShowDeleteModal(entry)}
                  onShowDetail={() => setShowDetailModal(entry)}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                {activeTab === 'all' ? '📚' : LORE_FILTER_TABS.find(t => t.type === activeTab)?.icon}
              </div>
              <h3>
                {searchQuery
                  ? 'No matching entries'
                  : activeTab === 'all'
                    ? 'Start building your world'
                    : `No ${LORE_FILTER_TABS.find(t => t.type === activeTab)?.label.toLowerCase()} yet`}
              </h3>
              <p>
                {searchQuery
                  ? 'Try adjusting your search terms or filters.'
                  : activeTab === 'all'
                    ? 'Add characters, locations, events, and systems to bring your story to life.'
                    : `Create your first ${activeTab} entry to expand your universe.`}
              </p>
              {!searchQuery && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setEditEntry(null);
                    setShowModal(true);
                  }}
                >
                  Create First Entry
                </button>
              )}
            </div>
          )}

          {/* Keyboard shortcut hint */}
          <div className={styles.shortcutHint}>
            Press <kbd>?</kbd> for keyboard shortcuts
          </div>
        </div>
      </main>

      {/* Add/Edit Modal */}
      <AddLoreModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditEntry(null);
        }}
        onSave={handleSave}
        editEntry={editEntry}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3>Delete Lore Entry?</h3>
            <p>
              Are you sure you want to delete <strong>&quot;{showDeleteModal.name}&quot;</strong>?
              {showDeleteModal.associatedScenes && showDeleteModal.associatedScenes.length > 0 && (
                <> This entry is linked to {showDeleteModal.associatedScenes.length} scene{showDeleteModal.associatedScenes.length !== 1 ? 's' : ''}.</>
              )}
              <br />This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ background: 'var(--color-error)' }} onClick={() => handleDelete(showDeleteModal)}>
                Delete Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className={styles.modalOverlay} onClick={() => setShowBulkDeleteModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3>Delete {selectedEntries.size} Lore {selectedEntries.size === 1 ? 'Entry' : 'Entries'}?</h3>
            <p>
              Are you sure you want to delete these lore entries? This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setShowBulkDeleteModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ background: 'var(--color-error)' }} onClick={handleBulkDelete}>
                Delete {selectedEntries.size} {selectedEntries.size === 1 ? 'Entry' : 'Entries'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDetailModal(null)}>
          <div className={styles.detailModal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setShowDetailModal(null)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className={styles.detailContent}>
              <div className={styles.detailHeader}>
                <div
                  className={styles.detailTypeIcon}
                  style={{
                    backgroundColor: showDetailModal.type === 'character' ? '#a78bfa20' :
                      showDetailModal.type === 'location' ? '#34d39920' :
                      showDetailModal.type === 'event' ? '#fbbf2420' : '#60a5fa20',
                    color: showDetailModal.type === 'character' ? '#a78bfa' :
                      showDetailModal.type === 'location' ? '#34d399' :
                      showDetailModal.type === 'event' ? '#fbbf24' : '#60a5fa',
                  }}
                >
                  {showDetailModal.type === 'character' ? '👤' :
                    showDetailModal.type === 'location' ? '🏛️' :
                    showDetailModal.type === 'event' ? '📅' : '⚙️'}
                </div>
                <div className={styles.detailInfo}>
                  <h2>{showDetailModal.name}</h2>
                  <span className={styles.detailType}>{showDetailModal.type}</span>
                </div>
              </div>

              <div className={styles.detailSection}>
                <h4>Summary</h4>
                <p>{showDetailModal.summary}</p>
              </div>

              {showDetailModal.description && (
                <div className={styles.detailSection}>
                  <h4>Description</h4>
                  <p className={styles.detailDescription}>{showDetailModal.description}</p>
                </div>
              )}

              {showDetailModal.tags && showDetailModal.tags.length > 0 && (
                <div className={styles.detailSection}>
                  <h4>Tags</h4>
                  <div className={styles.detailTags}>
                    {showDetailModal.tags.map((tag, i) => (
                      <span key={i} className={styles.detailTag}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {showDetailModal.associatedScenes && showDetailModal.associatedScenes.length > 0 && (
                <div className={styles.detailSection}>
                  <h4>Linked Scenes</h4>
                  <p className={styles.linkedScenes}>
                    This entry is referenced in {showDetailModal.associatedScenes.length} scene{showDetailModal.associatedScenes.length !== 1 ? 's' : ''}.
                  </p>
                </div>
              )}

              <div className={styles.detailMeta}>
                <span>Created: {new Date(showDetailModal.createdAt).toLocaleDateString()}</span>
                <span>Updated: {new Date(showDetailModal.updatedAt).toLocaleDateString()}</span>
              </div>

              <div className={styles.detailActions}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    handleEdit(showDetailModal);
                    setShowDetailModal(null);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Entry
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ color: 'var(--color-error)' }}
                  onClick={() => {
                    setShowDetailModal(null);
                    setShowDeleteModal(showDetailModal);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowShortcutsModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>Keyboard Shortcuts</h3>
            <div className={styles.shortcutsList}>
              <div className={styles.shortcut}>
                <kbd>N</kbd>
                <span>New lore entry</span>
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
                <kbd>S</kbd>
                <span>Toggle statistics</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>/</kbd>
                <span>Focus search</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>Ctrl+A</kbd>
                <span>Select all</span>
              </div>
              <div className={styles.shortcut}>
                <kbd>Esc</kbd>
                <span>Clear selection / Close modals</span>
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

export const getServerSideProps: GetServerSideProps<LorePageProps> = async (context) => {
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

    const initialEntries = await getProjectLoreAsync(projectId);

    return {
      props: {
        project,
        initialEntries,
      },
    };
  } catch (error) {
    console.error('Failed to load project:', error);
    return { notFound: true };
  }
};

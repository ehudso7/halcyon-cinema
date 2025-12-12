import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import ProjectCard from '@/components/ProjectCard';
import CreateProjectModal from '@/components/CreateProjectModal';
import QuickCreateModal, { QuickCreateData } from '@/components/QuickCreateModal';
import CinematicResults from '@/components/CinematicResults';
import { useToast } from '@/components/Toast';
import { Project } from '@/types';
import { getAllProjectsAsync } from '@/utils/storage';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import styles from '@/styles/Home.module.css';

interface HomeProps {
  projects: Project[];
  isNewUser: boolean;
}

type SortOption = 'newest' | 'oldest' | 'name' | 'name-desc' | 'scenes' | 'scenes-desc';
type ViewMode = 'grid' | 'list';

export default function Home({ projects: initialProjects, isNewUser }: HomeProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Core state
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Search, sort, and view state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showWelcome, setShowWelcome] = useState(isNewUser);

  // Selection state for bulk operations
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Edit modal state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Delete confirmation state
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick Create state
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [generatedStoryData, setGeneratedStoryData] = useState<{
    projectName: string;
    projectDescription?: string;
    logline?: string;
    tagline?: string;
    directorsConcept?: string;
    genre?: string;
    tone?: string;
    visualStyle?: string;
    styleGuide?: {
      primaryStyle: string;
      colorPalette: string[];
      lightingApproach: string;
      cameraStyle: string;
      inspirationFilms: string[];
      toneKeywords: string[];
      visualMotifs: string[];
    };
    characters?: Array<{
      name: string;
      role: string;
      description: string;
      archetype: string;
      emotionalArc: string;
      traits: string[];
      visualDescription: string;
      voiceStyle: string;
    }>;
    scenes?: Array<{
      sceneNumber: number;
      title: string;
      slugline: string;
      setting: string;
      timeOfDay: string;
      prompt: string;
      screenplay: string;
      shotType: string;
      mood: string;
      lighting: string;
      characters: string[];
      keyActions: string[];
      emotionalBeat: string;
    }>;
    lore?: Array<{
      type: 'location' | 'event' | 'system' | 'object' | 'concept';
      name: string;
      summary: string;
      description: string;
      visualMotifs: string[];
    }>;
    qualityMetrics?: {
      narrativeCoherence: number;
      characterDepth: number;
      worldBuilding: number;
      visualClarity: number;
      overallScore: number;
    };
  } | null>(null);
  const [quickCreateData, setQuickCreateData] = useState<QuickCreateData | null>(null);

  // Load preferences from localStorage
  useEffect(() => {
    const savedSort = localStorage.getItem('halcyon-sort') as SortOption;
    const savedView = localStorage.getItem('halcyon-view') as ViewMode;
    if (savedSort) setSortBy(savedSort);
    if (savedView) setViewMode(savedView);

    // Check if user has dismissed welcome
    const welcomeDismissed = localStorage.getItem('halcyon-welcome-dismissed');
    if (welcomeDismissed) setShowWelcome(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Allow Escape to blur inputs
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key) {
        case 'n':
          e.preventDefault();
          setIsModalOpen(true);
          break;
        case 'q':
          e.preventDefault();
          setIsQuickCreateOpen(true);
          break;
        case '/':
          e.preventDefault();
          searchInputRef.current?.focus();
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardHelp(true);
          break;
        case 'Escape':
          setShowKeyboardHelp(false);
          setIsSelectionMode(false);
          setSelectedProjects(new Set());
          break;
        case 'g':
          e.preventDefault();
          handleViewModeChange('grid');
          break;
        case 'l':
          e.preventDefault();
          handleViewModeChange('list');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Get the most recently updated project for "Continue" button
  const lastProject = useMemo(() => {
    if (projects.length === 0) return null;
    return projects.reduce((latest, current) =>
      new Date(current.updatedAt) > new Date(latest.updatedAt) ? current : latest
    );
  }, [projects]);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.description?.toLowerCase().includes(query))
      );
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'scenes':
        result.sort((a, b) => b.scenes.length - a.scenes.length);
        break;
      case 'scenes-desc':
        result.sort((a, b) => a.scenes.length - b.scenes.length);
        break;
    }

    return result;
  }, [projects, searchQuery, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    const totalScenes = projects.reduce((sum, p) => sum + p.scenes.length, 0);
    const totalCharacters = projects.reduce((sum, p) => sum + (p.characters?.length || 0), 0);
    return {
      projects: projects.length,
      scenes: totalScenes,
      characters: totalCharacters,
    };
  }, [projects]);

  const userName = session?.user?.name?.split(' ')[0] || 'Creator';

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    localStorage.setItem('halcyon-sort', newSort);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('halcyon-view', mode);
  };

  const handleCreateProject = async (name: string, description: string) => {
    setIsCreating(true);
    setCreateError('');
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          router.push('/auth/signin');
          return;
        }
        throw new Error(errorData.error || 'Failed to create project');
      }

      const newProject = await response.json();
      setProjects(prev => [newProject, ...prev]);
      setIsModalOpen(false);
      setCreateError('');
      showToast('Project created successfully!', 'success');
      router.push(`/project/${newProject.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      setCreateError(error instanceof Error ? error.message : 'Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDuplicateProject = async (project: Project) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${project.name} (Copy)`,
          description: project.description,
        }),
      });

      if (!response.ok) throw new Error('Failed to duplicate project');

      const newProject = await response.json();
      setProjects(prev => [newProject, ...prev]);
      showToast('Project duplicated successfully!', 'success');
    } catch {
      showToast('Failed to duplicate project', 'error');
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingProject) return;
    setIsEditing(true);

    try {
      const response = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDescription }),
      });

      if (!response.ok) throw new Error('Failed to update project');

      const updatedProject = await response.json();
      setProjects(prev => prev.map(p => p.id === editingProject.id ? updatedProject : p));
      setEditingProject(null);
      showToast('Project updated successfully!', 'success');
    } catch {
      showToast('Failed to update project', 'error');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deletingProject) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/projects/${deletingProject.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete project');

      setProjects(prev => prev.filter(p => p.id !== deletingProject.id));
      setDeletingProject(null);
      showToast('Project deleted successfully!', 'success');
    } catch {
      showToast('Failed to delete project', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProjects.size === 0) return;

    const confirmed = window.confirm(`Delete ${selectedProjects.size} project(s)? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await Promise.all(
        Array.from(selectedProjects).map(id =>
          fetch(`/api/projects/${id}`, { method: 'DELETE' })
        )
      );

      setProjects(prev => prev.filter(p => !selectedProjects.has(p.id)));
      setSelectedProjects(new Set());
      setIsSelectionMode(false);
      showToast(`${selectedProjects.size} project(s) deleted`, 'success');
    } catch {
      showToast('Failed to delete some projects', 'error');
    }
  };

  const toggleProjectSelection = useCallback((projectId: string) => {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filteredProjects.map(p => p.id)));
    }
  };

  const dismissWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('halcyon-welcome-dismissed', 'true');
  };

  // Quick Create: Generate full project from a single prompt
  const handleQuickCreate = async (data: QuickCreateData) => {
    setIsGenerating(true);
    setQuickCreateData(data);
    setGenerationStep('Weaving narrative threads...');

    try {
      // Step 1: Expand the story using AI
      const expandResponse = await fetch('/api/expand-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!expandResponse.ok) {
        const errorData = await expandResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate story');
      }

      const storyData = await expandResponse.json();

      // Store generated data and show results
      setGeneratedStoryData(storyData);
      setIsQuickCreateOpen(false);
      setIsGenerating(false);
      setGenerationStep('');
    } catch (error) {
      console.error('Quick create error:', error);
      showToast(error instanceof Error ? error.message : 'Failed to generate story', 'error');
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  // Create project from generated story data
  const handleCreateFromResults = async () => {
    if (!generatedStoryData) return;

    setIsCreating(true);
    try {
      // Step 1: Create the project
      const projectResponse = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: generatedStoryData.projectName,
          description: generatedStoryData.projectDescription,
        }),
      });

      if (!projectResponse.ok) {
        throw new Error('Failed to create project');
      }

      const newProject = await projectResponse.json();
      const projectId = newProject.id;

      // Track partial failures for user feedback
      let failedCharacters = 0;
      let failedLore = 0;
      let failedScenes = 0;

      // Step 2: Create characters (in parallel)
      const characterPromises = (generatedStoryData.characters || []).map(async (char) => {
        const response = await fetch(`/api/projects/${projectId}/characters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: char.name,
            description: char.description,
            traits: char.traits || [],
            archetype: char.archetype,
            emotionalArc: char.emotionalArc,
            visualDescription: char.visualDescription,
            voiceStyle: char.voiceStyle,
          }),
        });
        if (!response.ok) failedCharacters++;
        return response;
      });

      // Step 3: Create lore entries (in parallel)
      const lorePromises = (generatedStoryData.lore || []).map(async (lore) => {
        const response = await fetch(`/api/projects/${projectId}/lore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: lore.type,
            name: lore.name,
            summary: lore.summary,
            description: lore.description,
            visualMotifs: lore.visualMotifs,
          }),
        });
        if (!response.ok) failedLore++;
        return response;
      });

      // Wait for characters and lore to be created
      await Promise.allSettled([...characterPromises, ...lorePromises]);

      // Step 4: Create scenes sequentially (to maintain order)
      for (const scene of generatedStoryData.scenes || []) {
        const sceneResponse = await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            prompt: scene.prompt,
            title: scene.title,
            metadata: {
              style: generatedStoryData.visualStyle || quickCreateData?.genre,
              slugline: scene.slugline,
              screenplay: scene.screenplay,
              shotType: scene.shotType,
              mood: scene.mood,
              lighting: scene.lighting,
              emotionalBeat: scene.emotionalBeat,
              keyActions: scene.keyActions,
            },
          }),
        });
        if (!sceneResponse.ok) failedScenes++;
      }

      // Refresh projects list
      setProjects(prev => [newProject, ...prev]);
      setGeneratedStoryData(null);
      setQuickCreateData(null);

      // Provide appropriate feedback based on results
      const totalFailures = failedCharacters + failedLore + failedScenes;
      if (totalFailures > 0) {
        showToast(`Project created with some issues (${totalFailures} items failed to save)`, 'warning');
      } else {
        showToast('Project created with AI-generated content!', 'success');
      }

      // Navigate to the new project
      router.push(`/project/${projectId}`);
    } catch (error) {
      console.error('Create from results error:', error);
      showToast(error instanceof Error ? error.message : 'Failed to create project', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  // Regenerate with same settings
  const handleRegenerate = () => {
    if (quickCreateData) {
      setGeneratedStoryData(null);
      setIsQuickCreateOpen(true);
      // Auto-submit after a short delay to let modal render
      setTimeout(() => {
        handleQuickCreate(quickCreateData);
      }, 100);
    }
  };

  // Close results and start fresh
  const handleCloseResults = () => {
    setGeneratedStoryData(null);
    setQuickCreateData(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCreateError('');
  };

  // Highlight search matches
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className={styles.highlight}>{part}</mark> : part
    );
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
          {/* Hero Section */}
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
                onClick={() => setIsQuickCreateOpen(true)}
                className="btn btn-primary"
                disabled={isGenerating}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Quick Create
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn btn-secondary"
                disabled={isCreating}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {projects.length === 0 ? 'Start Your First Project' : 'Create New Project'}
              </button>
            </div>
          </div>

          {/* Statistics Cards */}
          {projects.length > 0 && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                  </svg>
                </div>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{stats.projects}</span>
                  <span className={styles.statLabel}>Projects</span>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{stats.scenes}</span>
                  <span className={styles.statLabel}>Scenes</span>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{stats.characters}</span>
                  <span className={styles.statLabel}>Characters</span>
                </div>
              </div>
              <button
                className={styles.statCard}
                onClick={() => setShowKeyboardHelp(true)}
                title="Keyboard shortcuts"
              >
                <div className={styles.statIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                    <line x1="6" y1="8" x2="6" y2="8" />
                    <line x1="10" y1="8" x2="10" y2="8" />
                    <line x1="14" y1="8" x2="14" y2="8" />
                    <line x1="18" y1="8" x2="18" y2="8" />
                    <line x1="6" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="18" y2="12" />
                    <line x1="8" y1="16" x2="16" y2="16" />
                  </svg>
                </div>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>?</span>
                  <span className={styles.statLabel}>Shortcuts</span>
                </div>
              </button>
            </div>
          )}

          {/* Projects Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Your Projects</h2>

              {projects.length > 0 && (
                <div className={styles.controls}>
                  {/* Search */}
                  <div className={styles.searchWrapper}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search projects... (press /)"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className={styles.searchInput}
                    />
                    {searchQuery && (
                      <button
                        className={styles.clearSearch}
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Sort Dropdown */}
                  <select
                    value={sortBy}
                    onChange={e => handleSortChange(e.target.value as SortOption)}
                    className={styles.sortSelect}
                    aria-label="Sort projects"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="name">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="scenes">Most Scenes</option>
                    <option value="scenes-desc">Fewest Scenes</option>
                  </select>

                  {/* View Toggle */}
                  <div className={styles.viewToggle}>
                    <button
                      className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                      onClick={() => handleViewModeChange('grid')}
                      title="Grid view (G)"
                      aria-pressed={viewMode === 'grid'}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                      </svg>
                    </button>
                    <button
                      className={`${styles.viewBtn} ${viewMode === 'list' ? styles.active : ''}`}
                      onClick={() => handleViewModeChange('list')}
                      title="List view (L)"
                      aria-pressed={viewMode === 'list'}
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

                  {/* Selection Mode Toggle */}
                  <button
                    className={`${styles.selectBtn} ${isSelectionMode ? styles.active : ''}`}
                    onClick={() => {
                      setIsSelectionMode(!isSelectionMode);
                      if (isSelectionMode) setSelectedProjects(new Set());
                    }}
                    title="Select multiple"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 11 12 14 22 4" />
                      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Bulk Actions Bar */}
            {isSelectionMode && selectedProjects.size > 0 && (
              <div className={styles.bulkActions}>
                <span className={styles.selectedCount}>
                  {selectedProjects.size} selected
                </span>
                <button onClick={handleSelectAll} className={styles.bulkBtn}>
                  {selectedProjects.size === filteredProjects.length ? 'Deselect All' : 'Select All'}
                </button>
                <button onClick={handleBulkDelete} className={`${styles.bulkBtn} ${styles.danger}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Delete Selected
                </button>
              </div>
            )}

            {/* Projects Grid/List */}
            {projects.length > 0 ? (
              <>
                {filteredProjects.length > 0 ? (
                  <div className={viewMode === 'grid' ? 'grid grid-2' : styles.listView}>
                    {filteredProjects.map(project => (
                      <div key={project.id} className={styles.projectWrapper}>
                        {isSelectionMode && (
                          <label className={styles.checkbox}>
                            <input
                              type="checkbox"
                              checked={selectedProjects.has(project.id)}
                              onChange={() => toggleProjectSelection(project.id)}
                            />
                            <span className={styles.checkmark} />
                          </label>
                        )}
                        <ProjectCard
                          project={project}
                          viewMode={viewMode}
                          searchQuery={searchQuery}
                          highlightMatch={highlightMatch}
                        />
                        <div className={styles.projectActions}>
                          <button
                            onClick={(e) => { e.preventDefault(); handleEditProject(project); }}
                            className={styles.actionBtn}
                            title="Edit project"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => { e.preventDefault(); handleDuplicateProject(project); }}
                            className={styles.actionBtn}
                            title="Duplicate project"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => { e.preventDefault(); setDeletingProject(project); }}
                            className={`${styles.actionBtn} ${styles.danger}`}
                            title="Delete project"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.noResults}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <h3>No projects found</h3>
                    <p>No projects match &ldquo;{searchQuery}&rdquo;. Try a different search term.</p>
                    <button onClick={() => setSearchQuery('')} className="btn btn-secondary">
                      Clear Search
                    </button>
                  </div>
                )}
              </>
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

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleCreateProject}
        isSubmitting={isCreating}
        externalError={createError}
      />

      {/* Quick Create Modal */}
      <QuickCreateModal
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        onGenerate={handleQuickCreate}
        isGenerating={isGenerating}
        generationStep={generationStep}
      />

      {/* Cinematic Results Modal */}
      {generatedStoryData && (
        <CinematicResults
          projectName={generatedStoryData.projectName}
          projectDescription={generatedStoryData.projectDescription}
          logline={generatedStoryData.logline}
          tagline={generatedStoryData.tagline}
          directorsConcept={generatedStoryData.directorsConcept}
          genre={generatedStoryData.genre}
          tone={generatedStoryData.tone}
          visualStyle={generatedStoryData.visualStyle}
          styleGuide={generatedStoryData.styleGuide}
          characters={generatedStoryData.characters}
          scenes={generatedStoryData.scenes}
          lore={generatedStoryData.lore}
          qualityMetrics={generatedStoryData.qualityMetrics}
          onCreateProject={handleCreateFromResults}
          onRegenerate={handleRegenerate}
          onClose={handleCloseResults}
        />
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className={styles.modalOverlay} onClick={() => setEditingProject(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Edit Project</h3>
              <button onClick={() => setEditingProject(null)} className={styles.closeBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label htmlFor="editName">Project Name</label>
                <input
                  id="editName"
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="input"
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="editDescription">Description (optional)</label>
                <textarea
                  id="editDescription"
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  className="input"
                  rows={3}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button onClick={() => setEditingProject(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="btn btn-primary"
                disabled={!editName.trim() || isEditing}
              >
                {isEditing ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProject && (
        <div className={styles.modalOverlay} onClick={() => setDeletingProject(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={`${styles.modalHeader} ${styles.danger}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <h3>Delete Project</h3>
            </div>
            <div className={styles.modalBody}>
              <p>Are you sure you want to delete <strong>&ldquo;{deletingProject.name}&rdquo;</strong>?</p>
              <p className={styles.warningText}>
                This will permanently delete all {deletingProject.scenes.length} scene(s) and cannot be undone.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button onClick={() => setDeletingProject(null)} className="btn btn-secondary">
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

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardHelp && (
        <div className={styles.modalOverlay} onClick={() => setShowKeyboardHelp(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Keyboard Shortcuts</h3>
              <button onClick={() => setShowKeyboardHelp(false)} className={styles.closeBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.shortcutList}>
                <div className={styles.shortcut}>
                  <kbd>Q</kbd>
                  <span>Quick Create (AI-powered)</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>N</kbd>
                  <span>Create new project</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>/</kbd>
                  <span>Focus search</span>
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
                  <kbd>?</kbd>
                  <span>Show this help</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Esc</kbd>
                  <span>Close modals / Clear selection</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Modal for New Users */}
      {showWelcome && (
        <div className={styles.modalOverlay}>
          <div className={styles.welcomeModal}>
            <div className={styles.welcomeHeader}>
              <span className={styles.welcomeIcon}>🎬</span>
              <h2>Welcome to HALCYON-Cinema!</h2>
            </div>
            <div className={styles.welcomeBody}>
              <p>Your AI-powered cinematic studio is ready. Here&apos;s how to get started:</p>
              <div className={styles.welcomeSteps}>
                <div className={styles.welcomeStep}>
                  <div className={styles.stepNumber}>1</div>
                  <div className={styles.stepContent}>
                    <h4>Create a Project</h4>
                    <p>Start by creating a new project to organize your scenes</p>
                  </div>
                </div>
                <div className={styles.welcomeStep}>
                  <div className={styles.stepNumber}>2</div>
                  <div className={styles.stepContent}>
                    <h4>Describe Your Scene</h4>
                    <p>Use natural language to describe what you want to visualize</p>
                  </div>
                </div>
                <div className={styles.welcomeStep}>
                  <div className={styles.stepNumber}>3</div>
                  <div className={styles.stepContent}>
                    <h4>Generate & Refine</h4>
                    <p>AI creates your scene - adjust style, lighting, and mood</p>
                  </div>
                </div>
                <div className={styles.welcomeStep}>
                  <div className={styles.stepNumber}>4</div>
                  <div className={styles.stepContent}>
                    <h4>Export & Share</h4>
                    <p>Download as PDF storyboard or ZIP with all assets</p>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.welcomeFooter}>
              <button onClick={dismissWelcome} className="btn btn-primary">
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const getServerSideProps: GetServerSideProps<HomeProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  // Redirect to landing if not authenticated
  if (!session?.user?.id) {
    return {
      redirect: {
        destination: '/landing',
        permanent: false,
      },
    };
  }

  try {
    const userProjects = await getAllProjectsAsync(session.user.id);

    return {
      props: {
        projects: userProjects,
        isNewUser: userProjects.length === 0,
      },
    };
  } catch (error) {
    console.error('Failed to load projects:', error);
    return {
      props: {
        projects: [],
        isNewUser: true,
      },
    };
  }
};

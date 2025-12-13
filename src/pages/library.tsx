import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/Header';
import ImageWithFallback from '@/components/ImageWithFallback';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { Project, Scene } from '@/types';
import { getAllProjectsAsync } from '@/utils/storage';
import styles from '@/styles/Library.module.css';

interface LibraryPageProps {
  projects: Project[];
  totalGenerations: number;
}

interface GenerationItem {
  id: string;
  projectId: string;
  projectName: string;
  sceneId: string;
  prompt: string;
  imageUrl: string | null;
  mediaType: 'image' | 'video';
  createdAt: string;
  metadata?: Scene['metadata'];
}

export default function LibraryPage({ projects, totalGenerations }: LibraryPageProps) {
  const [generations, setGenerations] = useState<GenerationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Flatten all scenes from all projects into generations
  useEffect(() => {
    const allGenerations: GenerationItem[] = [];

    projects.forEach(project => {
      project.scenes.forEach(scene => {
        if (scene.imageUrl) {
          allGenerations.push({
            id: `${project.id}-${scene.id}`,
            projectId: project.id,
            projectName: project.name,
            sceneId: scene.id,
            prompt: scene.prompt,
            imageUrl: scene.imageUrl,
            mediaType: scene.metadata?.mediaType || 'image',
            createdAt: scene.createdAt,
            metadata: scene.metadata,
          });
        }
      });
    });

    // Sort by creation date
    allGenerations.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    setGenerations(allGenerations);
  }, [projects, sortBy]);

  // Filter generations
  const filteredGenerations = generations.filter(gen => {
    // Type filter
    if (filter !== 'all' && gen.mediaType !== filter) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        gen.prompt.toLowerCase().includes(query) ||
        gen.projectName.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const handleSelectAll = () => {
    if (selectedItems.size === filteredGenerations.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredGenerations.map(g => g.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleDownloadSelected = async () => {
    for (const id of selectedItems) {
      const gen = generations.find(g => g.id === id);
      if (gen?.imageUrl) {
        const link = document.createElement('a');
        link.href = gen.imageUrl;
        link.download = `${gen.projectName}-${gen.sceneId}.${gen.mediaType === 'video' ? 'mp4' : 'png'}`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise(resolve => setTimeout(resolve, 500)); // Delay between downloads
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <>
      <Head>
        <title>My Library | HALCYON-Cinema</title>
        <meta name="description" content="Browse your AI-generated content library" />
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <h1 className={styles.title}>My Library</h1>
              <p className={styles.subtitle}>
                {totalGenerations} generations across {projects.length} projects
              </p>
            </div>

            <div className={styles.controls}>
              {/* Search */}
              <div className={styles.searchBox}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search generations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Filters */}
              <div className={styles.filters}>
                <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                  <option value="all">All Types</option>
                  <option value="image">Images Only</option>
                  <option value="video">Videos Only</option>
                </select>

                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>

                <div className={styles.viewToggle}>
                  <button
                    className={viewMode === 'grid' ? styles.active : ''}
                    onClick={() => setViewMode('grid')}
                    title="Grid view"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                  </button>
                  <button
                    className={viewMode === 'list' ? styles.active : ''}
                    onClick={() => setViewMode('list')}
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
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedItems.size > 0 && (
            <div className={styles.bulkActions}>
              <span>{selectedItems.size} selected</span>
              <button onClick={handleSelectAll}>
                {selectedItems.size === filteredGenerations.length ? 'Deselect All' : 'Select All'}
              </button>
              <button onClick={handleDownloadSelected}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Selected
              </button>
              <button onClick={() => setSelectedItems(new Set())}>Clear Selection</button>
            </div>
          )}

          {/* Generations Grid/List */}
          {filteredGenerations.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <h3>No generations yet</h3>
              <p>Start creating scenes in your projects to build your library.</p>
              <Link href="/" className="btn btn-primary">
                Go to Projects
              </Link>
            </div>
          ) : (
            <div className={`${styles.generations} ${styles[viewMode]}`}>
              {filteredGenerations.map((gen) => (
                <div
                  key={gen.id}
                  className={`${styles.generationCard} ${selectedItems.has(gen.id) ? styles.selected : ''}`}
                >
                  <div className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={selectedItems.has(gen.id)}
                      onChange={() => handleSelect(gen.id)}
                    />
                  </div>

                  <Link
                    href={`/project/${gen.projectId}/scene/${gen.sceneId}`}
                    className={styles.mediaContainer}
                  >
                    {gen.mediaType === 'video' ? (
                      <>
                        <video src={gen.imageUrl || ''} className={styles.media} muted />
                        <span className={styles.videoBadge}>VIDEO</span>
                      </>
                    ) : (
                      <ImageWithFallback
                        src={gen.imageUrl}
                        alt={gen.prompt}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className={styles.media}
                        fallbackType="scene"
                      />
                    )}
                    <div className={styles.overlay}>
                      <span>View Scene</span>
                    </div>
                  </Link>

                  <div className={styles.info}>
                    <p className={styles.prompt}>{gen.prompt}</p>
                    <div className={styles.meta}>
                      <Link href={`/project/${gen.projectId}`} className={styles.project}>
                        {gen.projectName}
                      </Link>
                      <span className={styles.date}>{formatDate(gen.createdAt)}</span>
                    </div>
                    {gen.metadata && (
                      <div className={styles.tags}>
                        {gen.metadata.style && <span className={styles.tag}>{gen.metadata.style}</span>}
                        {gen.metadata.shotType && <span className={styles.tag}>{gen.metadata.shotType}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<LibraryPageProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session?.user?.id) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }

  try {
    const projects = await getAllProjectsAsync(session.user.id);

    // Count total generations (scenes with imageUrl)
    const totalGenerations = projects.reduce((count, project) => {
      return count + project.scenes.filter(scene => scene.imageUrl).length;
    }, 0);

    return {
      props: {
        projects: JSON.parse(JSON.stringify(projects)),
        totalGenerations,
      },
    };
  } catch (error) {
    console.error('Error loading library:', error);
    return {
      props: {
        projects: [],
        totalGenerations: 0,
      },
    };
  }
};

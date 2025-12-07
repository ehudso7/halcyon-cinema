import { useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/Header';
import LoreCard from '@/components/LoreCard';
import AddLoreModal from '@/components/AddLoreModal';
import { LoreEntry, LoreType, Project } from '@/types';
import { getProjectById, getProjectLore } from '@/utils/storage';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import styles from '@/styles/Lore.module.css';

const LORE_TABS: { type: LoreType | 'all'; label: string; icon: string }[] = [
  { type: 'all', label: 'All', icon: '📚' },
  { type: 'character', label: 'Characters', icon: '👤' },
  { type: 'location', label: 'Locations', icon: '🏛️' },
  { type: 'event', label: 'Events', icon: '📅' },
  { type: 'system', label: 'Systems', icon: '⚙️' },
];

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
        // Update existing
        const response = await fetch(`/api/projects/${project.id}/lore/${editEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (response.ok) {
          fetchLore();
        } else {
          const data = await response.json();
          setError(data.error || 'Failed to update lore entry');
        }
      } else {
        // Create new
        const response = await fetch(`/api/projects/${project.id}/lore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (response.ok) {
          fetchLore();
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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lore entry?')) return;

    clearError();
    try {
      const response = await fetch(`/api/projects/${project.id}/lore/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setEntries(prev => prev.filter(e => e.id !== id));
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete lore entry');
      }
    } catch (err) {
      console.error('Error deleting lore:', err);
      setError('Failed to delete lore entry. Please try again.');
    }
  };

  const handleEdit = (entry: LoreEntry) => {
    setEditEntry(entry);
    setShowModal(true);
  };

  const filteredEntries = activeTab === 'all'
    ? entries
    : entries.filter(e => e.type === activeTab);

  const getCounts = () => {
    const counts: Record<string, number> = { all: entries.length };
    LORE_TABS.slice(1).forEach(tab => {
      counts[tab.type] = entries.filter(e => e.type === tab.type).length;
    });
    return counts;
  };

  const counts = getCounts();

  return (
    <>
      <Head>
        <title>World Lore | {project.name} | HALCYON-Cinema</title>
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <div className={styles.breadcrumb}>
            <Link href="/">Projects</Link>
            <span>/</span>
            <Link href={`/project/${project.id}`}>{project.name}</Link>
            <span>/</span>
            <span>Lore</span>
          </div>

          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>World Lore</h1>
              <p className={styles.subtitle}>
                Build your universe — characters, locations, events, and systems
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditEntry(null);
                setShowModal(true);
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Lore
            </button>
          </div>

          <div className={styles.tabs}>
            {LORE_TABS.map(tab => (
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

          {error && (
            <div className="error-banner" style={{
              background: 'var(--color-error, #f44336)',
              color: 'white',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{error}</span>
              <button
                onClick={clearError}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1.2rem'
                }}
              >
                ×
              </button>
            </div>
          )}

          {filteredEntries.length > 0 ? (
            <div className={styles.grid}>
              {filteredEntries.map(entry => (
                <LoreCard
                  key={entry.id}
                  entry={entry}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                {activeTab === 'all' ? '📚' : LORE_TABS.find(t => t.type === activeTab)?.icon}
              </div>
              <h3>
                {activeTab === 'all'
                  ? 'Start building your world'
                  : `No ${LORE_TABS.find(t => t.type === activeTab)?.label.toLowerCase()} yet`}
              </h3>
              <p>
                {activeTab === 'all'
                  ? 'Add characters, locations, events, and systems to bring your story to life.'
                  : `Create your first ${activeTab} entry to expand your universe.`}
              </p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditEntry(null);
                  setShowModal(true);
                }}
              >
                Create First Entry
              </button>
            </div>
          )}
        </div>
      </main>

      <AddLoreModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditEntry(null);
        }}
        onSave={handleSave}
        editEntry={editEntry}
      />
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
  const project = getProjectById(projectId);

  if (!project) {
    return { notFound: true };
  }

  if (project.userId && project.userId !== session.user.id) {
    return { notFound: true };
  }

  const initialEntries = getProjectLore(projectId);

  return {
    props: {
      project,
      initialEntries,
    },
  };
};

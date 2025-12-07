import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/Header';
import LoreCard from '@/components/LoreCard';
import AddLoreModal from '@/components/AddLoreModal';
import { LoreEntry, LoreType } from '@/types';
import styles from '@/styles/Lore.module.css';

const LORE_TABS: { type: LoreType | 'all'; label: string; icon: string }[] = [
  { type: 'all', label: 'All', icon: '📚' },
  { type: 'character', label: 'Characters', icon: '👤' },
  { type: 'location', label: 'Locations', icon: '🏛️' },
  { type: 'event', label: 'Events', icon: '📅' },
  { type: 'system', label: 'Systems', icon: '⚙️' },
];

export default function LoreDashboard() {
  const router = useRouter();
  const { projectId } = router.query;

  const [entries, setEntries] = useState<LoreEntry[]>([]);
  const [activeTab, setActiveTab] = useState<LoreType | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<LoreEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    if (projectId && typeof projectId === 'string') {
      fetchLore();
      fetchProject();
    }
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const project = await response.json();
        setProjectName(project.name);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
    }
  };

  const fetchLore = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/lore`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data);
      }
    } catch (error) {
      console.error('Error fetching lore:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (entry: Omit<LoreEntry, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editEntry) {
        // Update existing
        const response = await fetch(`/api/projects/${projectId}/lore/${editEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (response.ok) {
          fetchLore();
        }
      } else {
        // Create new
        const response = await fetch(`/api/projects/${projectId}/lore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (response.ok) {
          fetchLore();
        }
      }
    } catch (error) {
      console.error('Error saving lore:', error);
    }
    setEditEntry(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lore entry?')) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/lore/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setEntries(prev => prev.filter(e => e.id !== id));
      }
    } catch (error) {
      console.error('Error deleting lore:', error);
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
        <title>World Lore | {projectName || 'Project'} | HALCYON-Cinema</title>
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <div className={styles.breadcrumb}>
            <Link href="/">Projects</Link>
            <span>/</span>
            <Link href={`/project/${projectId}`}>{projectName || 'Project'}</Link>
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

          {isLoading ? (
            <div className={styles.loading}>
              <span className="spinner" /> Loading lore...
            </div>
          ) : filteredEntries.length > 0 ? (
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

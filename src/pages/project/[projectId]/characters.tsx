import { useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/Header';
import CharacterManager from '@/components/CharacterManager';
import { Project, Character } from '@/types';
import { getProjectById } from '@/utils/storage';
import styles from '@/styles/Characters.module.css';

const PROJECT_TABS = [
  { id: 'scenes', label: 'Scenes', icon: '🎬' },
  { id: 'lore', label: 'World Lore', icon: '📚' },
  { id: 'characters', label: 'Characters', icon: '👤' },
  { id: 'sequence', label: 'Scene Flow', icon: '🎞️' },
];

interface CharactersPageProps {
  project: Project;
}

export default function CharactersPage({ project: initialProject }: CharactersPageProps) {
  const [project, setProject] = useState<Project>(initialProject);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

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
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete character');
      }
    } catch (err) {
      console.error('Error deleting character:', err);
      setError('Failed to delete character. Please try again.');
    }
  };

  return (
    <>
      <Head>
        <title>Characters | {project.name} | HALCYON-Cinema</title>
      </Head>

      <Header showBackLink backLinkHref="/" backLinkText="Projects" />

      <main className="page">
        <div className="container">
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <h1 className={styles.title}>{project.name}</h1>
              <p className={styles.meta}>
                {project.characters?.length || 0} characters
              </p>
            </div>
          </div>

          <nav className={styles.projectNav}>
            {PROJECT_TABS.map(tab => {
              const href = tab.id === 'scenes'
                ? `/project/${project.id}`
                : `/project/${project.id}/${tab.id}`;
              const isActive = tab.id === 'characters';

              return (
                <Link
                  key={tab.id}
                  href={href}
                  className={`${styles.navTab} ${isActive ? styles.active : ''}`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>

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

          <CharacterManager
            characters={project.characters || []}
            onAddCharacter={handleAddCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onDeleteCharacter={handleDeleteCharacter}
          />
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<CharactersPageProps> = async ({ params }) => {
  const projectId = params?.projectId as string;
  const project = getProjectById(projectId);

  if (!project) {
    return { notFound: true };
  }

  return {
    props: { project },
  };
};

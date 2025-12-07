import { useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import Head from 'next/head';
import Header from '@/components/Header';
import ProjectNavigation from '@/components/ProjectNavigation';
import CharacterManager from '@/components/CharacterManager';
import { Project, Character } from '@/types';
import { getProjectByIdAsync } from '@/utils/storage';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import styles from '@/styles/Characters.module.css';

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

          <ProjectNavigation projectId={project.id} activeTab="characters" />

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

import { useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/Header';
import CharacterManager from '@/components/CharacterManager';
import { Project, Character } from '@/types';
import { getProjectById, updateProject } from '@/utils/storage';
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

  const handleAddCharacter = async (characterData: Omit<Character, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'appearances'>) => {
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
      }
    } catch (error) {
      console.error('Error adding character:', error);
    }
  };

  const handleUpdateCharacter = async (id: string, updates: Partial<Character>) => {
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
      }
    } catch (error) {
      console.error('Error updating character:', error);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${project.id}/characters/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setProject(prev => ({
          ...prev,
          characters: prev.characters?.filter(c => c.id !== id) || [],
        }));
      }
    } catch (error) {
      console.error('Error deleting character:', error);
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

          <CharacterManager
            projectId={project.id}
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

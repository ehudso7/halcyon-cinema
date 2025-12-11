import { ReactNode } from 'react';
import Link from 'next/link';
import { Project } from '@/types';
import ImageWithFallback from './ImageWithFallback';
import styles from './ProjectCard.module.css';

interface ProjectCardProps {
  project: Project;
  viewMode?: 'grid' | 'list';
  searchQuery?: string;
  highlightMatch?: (text: string, query: string) => ReactNode;
}

export default function ProjectCard({
  project,
  viewMode = 'grid',
  searchQuery = '',
  highlightMatch,
}: ProjectCardProps) {
  const sceneCount = project.scenes.length;
  const characterCount = project.characters?.length || 0;
  const lastUpdated = new Date(project.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Get the first scene's image as thumbnail
  const thumbnail = project.scenes.find(s => s.imageUrl)?.imageUrl;

  // Helper to render text with optional highlighting
  const renderText = (text: string) => {
    if (highlightMatch && searchQuery) {
      return highlightMatch(text, searchQuery);
    }
    return text;
  };

  if (viewMode === 'list') {
    return (
      <Link href={`/project/${project.id}`} className={styles.listCard}>
        <div className={styles.listThumbnail}>
          <ImageWithFallback
            src={thumbnail}
            alt={project.name}
            fill
            sizes="80px"
            fallbackType="project"
          />
        </div>
        <div className={styles.listContent}>
          <h3 className={styles.listName}>{renderText(project.name)}</h3>
          {project.description && (
            <p className={styles.listDescription}>{renderText(project.description)}</p>
          )}
        </div>
        <div className={styles.listMeta}>
          <span className={styles.listStat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            {sceneCount}
          </span>
          {characterCount > 0 && (
            <span className={styles.listStat}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              {characterCount}
            </span>
          )}
          <span className={styles.listDate}>{lastUpdated}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/project/${project.id}`} className={styles.card}>
      <div className={styles.thumbnail}>
        <ImageWithFallback
          src={thumbnail}
          alt={project.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          fallbackType="project"
        />
        {sceneCount > 0 && (
          <div className={styles.badge}>
            {sceneCount} {sceneCount === 1 ? 'scene' : 'scenes'}
          </div>
        )}
      </div>
      <div className={styles.content}>
        <h3 className={styles.name}>{renderText(project.name)}</h3>
        {project.description && (
          <p className={styles.description}>{renderText(project.description)}</p>
        )}
        <div className={styles.meta}>
          <span className={styles.date}>{lastUpdated}</span>
          {characterCount > 0 && (
            <>
              <span className={styles.separator}>•</span>
              <span className={styles.characters}>
                {characterCount} {characterCount === 1 ? 'character' : 'characters'}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

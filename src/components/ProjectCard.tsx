import Link from 'next/link';
import Image from 'next/image';
import { Project } from '@/types';
import styles from './ProjectCard.module.css';

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const sceneCount = project.scenes.length;
  const lastUpdated = new Date(project.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Get the first scene's image as thumbnail
  const thumbnail = project.scenes.find(s => s.imageUrl)?.imageUrl;

  return (
    <Link href={`/project/${project.id}`} className={styles.card}>
      <div className={styles.thumbnail}>
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={project.name}
            className={styles.thumbnailImage}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className={styles.placeholder}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}
      </div>
      <div className={styles.content}>
        <h3 className={styles.name}>{project.name}</h3>
        {project.description && (
          <p className={styles.description}>{project.description}</p>
        )}
        <div className={styles.meta}>
          <span className={styles.sceneCount}>
            {sceneCount} {sceneCount === 1 ? 'scene' : 'scenes'}
          </span>
          <span className={styles.separator}>•</span>
          <span className={styles.date}>{lastUpdated}</span>
        </div>
      </div>
    </Link>
  );
}

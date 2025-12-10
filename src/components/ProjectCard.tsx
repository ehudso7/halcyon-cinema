import Link from 'next/link';
import { Project } from '@/types';
import ImageWithFallback from './ImageWithFallback';
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
        <ImageWithFallback
          src={thumbnail}
          alt={project.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          fallbackType="project"
        />
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

import Link from 'next/link';
import Image from 'next/image';
import { Scene } from '@/types';
import styles from './SceneCard.module.css';

interface SceneCardProps {
  scene: Scene;
  index: number;
}

export default function SceneCard({ scene, index }: SceneCardProps) {
  const timestamp = new Date(scene.createdAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const truncatedPrompt = scene.prompt.length > 100
    ? scene.prompt.slice(0, 100) + '...'
    : scene.prompt;

  return (
    <Link
      href={`/project/${scene.projectId}/scene/${scene.id}`}
      className={styles.card}
    >
      <div className={styles.thumbnail}>
        {scene.imageUrl ? (
          <Image
            src={scene.imageUrl}
            alt={`Scene ${index + 1}`}
            className={styles.image}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            priority={index < 3}
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
        <div className={styles.number}>Scene {index + 1}</div>
      </div>
      <div className={styles.content}>
        <p className={styles.prompt}>{truncatedPrompt}</p>
        <span className={styles.timestamp}>{timestamp}</span>
      </div>
    </Link>
  );
}

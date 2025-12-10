import Link from 'next/link';
import { Scene } from '@/types';
import ImageWithFallback from './ImageWithFallback';
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
        <ImageWithFallback
          src={scene.imageUrl}
          alt={`Scene ${index + 1}`}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          priority={index < 3}
          fallbackType="scene"
        />
        <div className={styles.number}>Scene {index + 1}</div>
        {scene.imageUrl && (
          <div className={styles.aiBadge}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            AI
          </div>
        )}
      </div>
      <div className={styles.content}>
        <p className={styles.prompt}>{truncatedPrompt}</p>
        <span className={styles.timestamp}>{timestamp}</span>
      </div>
    </Link>
  );
}

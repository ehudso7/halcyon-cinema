import Link from 'next/link';
import { Project } from '@/types';
import styles from './ProductionProgress.module.css';

interface ProductionProgressProps {
  project: Project;
}

interface ProgressStep {
  id: string;
  label: string;
  icon: string;
  href: string;
  count: number;
  isComplete: boolean;
  description: string;
}

export default function ProductionProgress({ project }: ProductionProgressProps) {
  const steps: ProgressStep[] = [
    {
      id: 'scenes',
      label: 'Scenes',
      icon: '🎬',
      href: `/project/${project.id}`,
      count: project.scenes.length,
      isComplete: project.scenes.length > 0,
      description: 'AI-generated visuals',
    },
    {
      id: 'characters',
      label: 'Characters',
      icon: '👤',
      href: `/project/${project.id}/characters`,
      count: project.characters?.length || 0,
      isComplete: (project.characters?.length || 0) > 0,
      description: 'Cast & appearances',
    },
    {
      id: 'lore',
      label: 'World Lore',
      icon: '📚',
      href: `/project/${project.id}/lore`,
      count: project.lore?.length || 0,
      isComplete: (project.lore?.length || 0) > 0,
      description: 'Locations, events, systems',
    },
    {
      id: 'sequence',
      label: 'Scene Flow',
      icon: '🎞️',
      href: `/project/${project.id}/sequence`,
      count: project.sequences?.length || 0,
      isComplete: (project.sequences?.length || 0) > 0 || project.scenes.length > 1,
      description: 'Narrative arrangement',
    },
  ];

  const completedSteps = steps.filter(s => s.isComplete).length;
  const progressPercent = Math.round((completedSteps / steps.length) * 100);

  // Calculate total duration if sequences exist
  const totalDuration = project.sequences?.reduce((acc, seq) => {
    return acc + seq.shots.reduce((shotAcc, shot) => shotAcc + (shot.duration || 4), 0);
  }, 0) || 0;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Production Progress</h2>
        <div className={styles.progressBadge}>
          <span className={styles.progressPercent}>{progressPercent}%</span>
          <span className={styles.progressLabel}>Complete</span>
        </div>
      </div>

      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{project.scenes.length}</span>
          <span className={styles.statLabel}>Scenes</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{project.characters?.length || 0}</span>
          <span className={styles.statLabel}>Characters</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{project.lore?.length || 0}</span>
          <span className={styles.statLabel}>Lore Entries</span>
        </div>
        {totalDuration > 0 && (
          <div className={styles.stat}>
            <span className={styles.statValue}>{formatDuration(totalDuration)}</span>
            <span className={styles.statLabel}>Duration</span>
          </div>
        )}
      </div>

      <div className={styles.steps}>
        {steps.map((step, index) => (
          <Link
            key={step.id}
            href={step.href}
            className={`${styles.step} ${step.isComplete ? styles.stepComplete : ''}`}
          >
            <div className={styles.stepNumber}>
              {step.isComplete ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <div className={styles.stepContent}>
              <div className={styles.stepHeader}>
                <span className={styles.stepIcon}>{step.icon}</span>
                <span className={styles.stepLabel}>{step.label}</span>
                {step.count > 0 && (
                  <span className={styles.stepCount}>{step.count}</span>
                )}
              </div>
              <p className={styles.stepDescription}>{step.description}</p>
            </div>
            <svg className={styles.stepArrow} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ))}
      </div>

      {completedSteps === steps.length && (
        <div className={styles.readyBanner}>
          <span className={styles.readyIcon}>🎉</span>
          <div>
            <strong>Ready to Export!</strong>
            <p>Your production has all the essential elements.</p>
          </div>
        </div>
      )}
    </div>
  );
}

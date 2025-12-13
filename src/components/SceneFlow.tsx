import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Scene } from '@/types';
import { FilmIcon } from './Icons';
import styles from './SceneFlow.module.css';

interface SceneFlowProps {
  scenes: Scene[];
  projectName: string;
  onClose: () => void;
}

export default function SceneFlow({ scenes, projectName, onClose }: SceneFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(-1); // -1 for title card
  const [isPlaying, setIsPlaying] = useState(true);
  const [transitionPhase, setTransitionPhase] = useState<'in' | 'out' | 'stable'>('in');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const nextScene = useCallback(() => {
    setTransitionPhase('out');
    setTimeout(() => {
      setCurrentIndex(prev => {
        if (prev >= scenes.length) {
          return -1; // Loop back to title
        }
        return prev + 1;
      });
      setTransitionPhase('in');
      setTimeout(() => setTransitionPhase('stable'), 500);
    }, 500);
  }, [scenes.length]);

  const prevScene = useCallback(() => {
    setTransitionPhase('out');
    setTimeout(() => {
      setCurrentIndex(prev => {
        if (prev <= -1) {
          return scenes.length; // Loop to end
        }
        return prev - 1;
      });
      setTransitionPhase('in');
      setTimeout(() => setTransitionPhase('stable'), 500);
    }, 500);
  }, [scenes.length]);

  const goToScene = (index: number) => {
    if (index === currentIndex) return;
    setTransitionPhase('out');
    setTimeout(() => {
      setCurrentIndex(index);
      setTransitionPhase('in');
      setTimeout(() => setTransitionPhase('stable'), 500);
    }, 500);
  };

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        nextScene();
      }, 4000); // 4 seconds per scene
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, nextScene]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextScene();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevScene();
      } else if (e.key === 'p') {
        setIsPlaying(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextScene, prevScene, onClose]);

  const currentScene = currentIndex >= 0 && currentIndex < scenes.length ? scenes[currentIndex] : null;
  const isTitle = currentIndex === -1;
  const isEnd = currentIndex === scenes.length;

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        {/* Close button */}
        <button onClick={onClose} className={styles.closeButton}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Main content */}
        <div className={`${styles.content} ${styles[transitionPhase]}`}>
          {isTitle ? (
            <div className={styles.titleCard}>
              <span className={styles.emoji}><FilmIcon size={48} color="#6366f1" /></span>
              <h1 className={styles.title}>{projectName}</h1>
              <p className={styles.subtitle}>{scenes.length} Scenes</p>
            </div>
          ) : isEnd ? (
            <div className={styles.endCard}>
              <span className={styles.emoji}><FilmIcon size={48} color="#6366f1" /></span>
              <h2 className={styles.endTitle}>The End</h2>
              <p className={styles.endSubtitle}>Created with HALCYON-Cinema</p>
              <button onClick={() => goToScene(-1)} className={styles.replayButton}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
                Replay
              </button>
            </div>
          ) : currentScene ? (
            <div className={styles.sceneCard}>
              {currentScene.imageUrl ? (
                <Image
                  src={currentScene.imageUrl}
                  alt={`Scene ${currentIndex + 1}`}
                  className={styles.sceneImage}
                  fill
                  sizes="100vw"
                  priority
                />
              ) : (
                <div className={styles.placeholder}>No Image</div>
              )}
              <div className={styles.sceneInfo}>
                <span className={styles.sceneNumber}>Scene {currentIndex + 1}</span>
                <p className={styles.scenePrompt}>{currentScene.prompt}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <button onClick={prevScene} className={styles.controlButton}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <button onClick={() => setIsPlaying(!isPlaying)} className={styles.playButton}>
            {isPlaying ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          <button onClick={nextScene} className={styles.controlButton}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Progress dots */}
        <div className={styles.progress}>
          <button
            onClick={() => goToScene(-1)}
            className={`${styles.dot} ${currentIndex === -1 ? styles.dotActive : ''}`}
            title="Title"
          />
          {scenes.map((_, i) => (
            <button
              key={i}
              onClick={() => goToScene(i)}
              className={`${styles.dot} ${currentIndex === i ? styles.dotActive : ''}`}
              title={`Scene ${i + 1}`}
            />
          ))}
          <button
            onClick={() => goToScene(scenes.length)}
            className={`${styles.dot} ${currentIndex === scenes.length ? styles.dotActive : ''}`}
            title="End"
          />
        </div>

        {/* Keyboard hints */}
        <div className={styles.hints}>
          <span>Space/→ Next</span>
          <span>← Previous</span>
          <span>P Pause</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}

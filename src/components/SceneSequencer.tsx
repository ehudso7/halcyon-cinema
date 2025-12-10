import { useState, useCallback } from 'react';
import Image from 'next/image';
import { Scene, ShotBlock } from '@/types';
import styles from './SceneSequencer.module.css';

interface SceneSequencerProps {
  scenes: Scene[];
  initialOrder?: ShotBlock[];
  onSave?: (shots: ShotBlock[]) => void;
  onExport?: (shots: ShotBlock[]) => void;
  isSaving?: boolean;
}

const TRANSITIONS = [
  { value: 'cut', label: 'Cut' },
  { value: 'fade', label: 'Fade' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'wipe', label: 'Wipe' },
];

export default function SceneSequencer({ scenes, initialOrder, onSave, onExport, isSaving = false }: SceneSequencerProps) {
  const [shots, setShots] = useState<ShotBlock[]>(() => {
    if (initialOrder && initialOrder.length > 0) {
      return initialOrder;
    }
    // Default: create shots from scenes in order
    return scenes.map((scene, index) => ({
      sceneId: scene.id,
      order: index,
      title: `Scene ${index + 1}`,
      duration: 5,
      transitionType: 'cut' as const,
    }));
  });

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingShot, setEditingShot] = useState<string | null>(null);

  const getSceneById = (id: string) => scenes.find(s => s.id === id);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newShots = [...shots];
    const [draggedItem] = newShots.splice(draggedIndex, 1);
    newShots.splice(index, 0, draggedItem);

    // Update order numbers
    newShots.forEach((shot, i) => {
      shot.order = i;
    });

    setShots(newShots);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const moveShot = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= shots.length) return;

    const newShots = [...shots];
    [newShots[fromIndex], newShots[toIndex]] = [newShots[toIndex], newShots[fromIndex]];
    newShots.forEach((shot, i) => {
      shot.order = i;
    });
    setShots(newShots);
  };

  const updateShot = useCallback((sceneId: string, updates: Partial<ShotBlock>) => {
    setShots(prev =>
      prev.map(shot =>
        shot.sceneId === sceneId ? { ...shot, ...updates } : shot
      )
    );
  }, []);

  const removeShot = (sceneId: string) => {
    setShots(prev => {
      const newShots = prev.filter(shot => shot.sceneId !== sceneId);
      newShots.forEach((shot, i) => {
        shot.order = i;
      });
      return newShots;
    });
  };

  const addScene = (sceneId: string) => {
    if (shots.some(s => s.sceneId === sceneId)) return;

    const scene = getSceneById(sceneId);
    if (!scene) return;

    setShots(prev => [
      ...prev,
      {
        sceneId,
        order: prev.length,
        title: `Scene ${prev.length + 1}`,
        duration: 5,
        transitionType: 'cut' as const,
      },
    ]);
  };

  const totalDuration = shots.reduce((sum, shot) => sum + (shot.duration || 0), 0);
  const unusedScenes = scenes.filter(s => !shots.some(shot => shot.sceneId === s.id));

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className={styles.sequencer}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Scene Flow</h2>
          <p className={styles.subtitle}>
            Drag scenes to reorder • {shots.length} shots • {formatDuration(totalDuration)} total
          </p>
        </div>
        <div className={styles.actions}>
          {onSave && (
            <button
              className="btn btn-secondary"
              onClick={() => onSave(shots)}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <span className={styles.spinner} />
                  Saving...
                </>
              ) : (
                'Save Sequence'
              )}
            </button>
          )}
          {onExport && (
            <button className="btn btn-primary" onClick={() => onExport(shots)}>
              Export Script
            </button>
          )}
        </div>
      </div>

      <div className={styles.timeline}>
        {shots.map((shot, index) => {
          const scene = getSceneById(shot.sceneId);
          if (!scene) return null;

          const isEditing = editingShot === shot.sceneId;

          return (
            <div
              key={shot.sceneId}
              className={`${styles.shotBlock} ${draggedIndex === index ? styles.dragging : ''}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div className={styles.shotNumber}>{index + 1}</div>

              <div className={styles.thumbnail}>
                {scene.imageUrl ? (
                  <Image
                    src={scene.imageUrl}
                    alt={shot.title || `Scene ${index + 1}`}
                    fill
                    sizes="120px"
                  />
                ) : (
                  <div className={styles.noImage}>🎬</div>
                )}
              </div>

              <div className={styles.shotInfo}>
                {isEditing ? (
                  <input
                    type="text"
                    value={shot.title || ''}
                    onChange={(e) => updateShot(shot.sceneId, { title: e.target.value })}
                    onBlur={() => setEditingShot(null)}
                    className={styles.titleInput}
                    autoFocus
                  />
                ) : (
                  <h4
                    className={styles.shotTitle}
                    onClick={() => setEditingShot(shot.sceneId)}
                  >
                    {shot.title || `Scene ${index + 1}`}
                  </h4>
                )}
                <p className={styles.shotPrompt}>{scene.prompt.slice(0, 60)}...</p>

                <div className={styles.shotMeta}>
                  <div className={styles.metaItem}>
                    <label>Duration:</label>
                    <input
                      type="number"
                      value={shot.duration || 5}
                      onChange={(e) => updateShot(shot.sceneId, { duration: parseInt(e.target.value) || 0 })}
                      min={1}
                      max={300}
                      className={styles.durationInput}
                    />
                    <span>sec</span>
                  </div>

                  <div className={styles.metaItem}>
                    <label>Transition:</label>
                    <select
                      value={shot.transitionType || 'cut'}
                      onChange={(e) => updateShot(shot.sceneId, { transitionType: e.target.value as ShotBlock['transitionType'] })}
                      className={styles.transitionSelect}
                    >
                      {TRANSITIONS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className={styles.shotActions}>
                <button
                  className={styles.moveBtn}
                  onClick={() => moveShot(index, 'up')}
                  disabled={index === 0}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  className={styles.moveBtn}
                  onClick={() => moveShot(index, 'down')}
                  disabled={index === shots.length - 1}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  className={styles.removeBtn}
                  onClick={() => removeShot(shot.sceneId)}
                  title="Remove from sequence"
                >
                  ×
                </button>
              </div>

              {index < shots.length - 1 && (
                <div className={styles.transitionMarker}>
                  {shot.transitionType?.toUpperCase() || 'CUT'}
                </div>
              )}
            </div>
          );
        })}

        {shots.length === 0 && (
          <div className={styles.emptyTimeline}>
            <p>No scenes in sequence. Add scenes from the panel below.</p>
          </div>
        )}
      </div>

      {unusedScenes.length > 0 && (
        <div className={styles.unusedScenes}>
          <h4>Available Scenes</h4>
          <div className={styles.unusedGrid}>
            {unusedScenes.map(scene => (
              <div
                key={scene.id}
                className={styles.unusedScene}
                onClick={() => addScene(scene.id)}
              >
                {scene.imageUrl ? (
                  <Image
                    src={scene.imageUrl}
                    alt={`Available scene`}
                    fill
                    sizes="80px"
                  />
                ) : (
                  <div className={styles.noImage}>🎬</div>
                )}
                <span>+ Add</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

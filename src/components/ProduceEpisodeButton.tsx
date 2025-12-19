import { useState, useCallback, useEffect } from 'react';
import { useCSRF } from '@/hooks/useCSRF';
import styles from '@/styles/ProduceEpisode.module.css';

interface ProduceEpisodeButtonProps {
  projectId: string;
  projectName: string;
  sceneCount: number;
  disabled?: boolean;
}

interface ProductionProgress {
  stage: string;
  progress: number;
  currentStep: string;
  completedSteps: string[];
  errors: string[];
}

interface ProductionEstimate {
  total: number;
  video: number;
  music: number;
  voiceover: number;
  assembly: number;
}

export default function ProduceEpisodeButton({
  projectId,
  projectName,
  sceneCount,
  disabled = false,
}: ProduceEpisodeButtonProps) {
  const { csrfFetch } = useCSRF();
  const [showModal, setShowModal] = useState(false);
  const [isProducing, setIsProducing] = useState(false);
  const [progress, setProgress] = useState<ProductionProgress | null>(null);
  const [result, setResult] = useState<{ videoUrl?: string; error?: string } | null>(null);
  const [estimate, setEstimate] = useState<ProductionEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  // Form state
  const [prompt, setPrompt] = useState('');
  const [durationInput, setDurationInput] = useState('30');
  const duration = durationInput === '' ? 0 : Number(durationInput);
  const [genre, setGenre] = useState('cinematic');
  const [includeMusic, setIncludeMusic] = useState(true);
  const [includeVoiceover, setIncludeVoiceover] = useState(false);
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p');

  const fetchEstimate = useCallback(async () => {
    setIsEstimating(true);
    try {
      const response = await csrfFetch('/api/produce-episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          prompt: prompt || `Create a ${genre} scene for ${projectName}`,
          targetDuration: duration,
          genre,
          estimateOnly: true,
          settings: {
            audioPreferences: {
              includeMusicTrack: includeMusic,
              includeVoiceover: includeVoiceover,
            },
            assemblyPreferences: { resolution },
          },
        }),
      });

      const data = await response.json();
      if (data.estimatedCredits) {
        setEstimate({
          total: data.estimatedCredits,
          video: data.video || 0,
          music: data.music || 0,
          voiceover: data.voiceover || 0,
          assembly: data.assembly || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch estimate:', error);
    } finally {
      setIsEstimating(false);
    }
  }, [projectId, projectName, prompt, duration, genre, includeMusic, includeVoiceover, resolution]);

  const handleOpenModal = useCallback(() => {
    setShowModal(true);
    setResult(null);
    setProgress(null);
    // Set default prompt based on project
    if (!prompt) {
      setPrompt(`Create a ${genre} scene for ${projectName}`);
    }
  }, [prompt, genre, projectName]);

  // Fetch estimate when modal opens
  useEffect(() => {
    if (showModal && !result && !progress) {
      fetchEstimate();
    }
  }, [showModal, result, progress, fetchEstimate]);

  const handleProduce = useCallback(async () => {
    setIsProducing(true);
    setProgress({
      stage: 'initializing',
      progress: 0,
      currentStep: 'Starting production...',
      completedSteps: [],
      errors: [],
    });
    setResult(null);

    try {
      const response = await csrfFetch('/api/produce-episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          prompt: prompt || `Create a ${genre} scene for ${projectName}`,
          targetDuration: duration,
          genre,
          quickMode: true,
          settings: {
            autoAssemble: true,
            audioPreferences: {
              includeMusicTrack: includeMusic,
              includeVoiceover: includeVoiceover,
              musicVolume: 0.3,
              voiceoverVolume: 1,
            },
            assemblyPreferences: {
              resolution,
              transitionType: 'fade',
              quality: 'high',
            },
          },
        }),
      });

      const data = await response.json();

      if (data.success && data.videoUrl) {
        setResult({ videoUrl: data.videoUrl });
        setProgress(data.progress || {
          stage: 'completed',
          progress: 100,
          currentStep: 'Production complete!',
          completedSteps: ['Video generation', 'Audio generation', 'Assembly'],
          errors: [],
        });
      } else {
        setResult({ error: data.error || 'Production failed' });
        setProgress(prev => prev ? {
          ...prev,
          stage: 'failed',
          errors: [data.error || 'Unknown error'],
        } : null);
      }
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Production failed' });
    } finally {
      setIsProducing(false);
    }
  }, [projectId, projectName, prompt, duration, genre, includeMusic, includeVoiceover, resolution]);

  const handleClose = useCallback(() => {
    if (!isProducing) {
      setShowModal(false);
    }
  }, [isProducing]);

  const handleDownload = useCallback(() => {
    if (result?.videoUrl) {
      const link = document.createElement('a');
      link.href = result.videoUrl;
      link.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_episode.mp4`;
      link.click();
    }
  }, [result, projectName]);

  return (
    <>
      <button
        onClick={handleOpenModal}
        className={`btn btn-primary ${styles.produceButton}`}
        disabled={disabled || sceneCount === 0}
        title="Produce Full Episode"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        Produce Episode
      </button>

      {showModal && (
        <div className={styles.modalOverlay} onClick={handleClose}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Produce Full Episode</h2>
              <button onClick={handleClose} className={styles.closeButton} disabled={isProducing}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.modalContent}>
              {!isProducing && !result?.videoUrl ? (
                <>
                  <div className={styles.formGroup}>
                    <label htmlFor="prompt">Scene Description</label>
                    <textarea
                      id="prompt"
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      placeholder="Describe your scene..."
                      rows={3}
                      className={styles.textarea}
                    />
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="duration">Duration (seconds)</label>
                      <input
                        id="duration"
                        type="number"
                        min={10}
                        max={300}
                        value={durationInput}
                        onChange={e => setDurationInput(e.target.value)}
                        onBlur={() => {
                          // Reset to minimum if empty or below minimum
                          if (durationInput === '' || duration < 10) {
                            setDurationInput('10');
                          }
                        }}
                        className={styles.input}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="genre">Genre</label>
                      <select
                        id="genre"
                        value={genre}
                        onChange={e => setGenre(e.target.value)}
                        className={styles.select}
                      >
                        <option value="cinematic">Cinematic</option>
                        <option value="action">Action</option>
                        <option value="drama">Drama</option>
                        <option value="comedy">Comedy</option>
                        <option value="horror">Horror</option>
                        <option value="sci-fi">Sci-Fi</option>
                        <option value="fantasy">Fantasy</option>
                        <option value="romance">Romance</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="resolution">Resolution</label>
                      <select
                        id="resolution"
                        value={resolution}
                        onChange={e => setResolution(e.target.value as '720p' | '1080p' | '4k')}
                        className={styles.select}
                      >
                        <option value="720p">720p (HD)</option>
                        <option value="1080p">1080p (Full HD)</option>
                        <option value="4k">4K (Ultra HD)</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <label className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={includeMusic}
                        onChange={e => setIncludeMusic(e.target.checked)}
                      />
                      Include background music
                    </label>

                    <label className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={includeVoiceover}
                        onChange={e => setIncludeVoiceover(e.target.checked)}
                      />
                      Include voiceover
                    </label>
                  </div>

                  {estimate && (
                    <div className={styles.estimate}>
                      <h4>Estimated Cost</h4>
                      <div className={styles.estimateBreakdown}>
                        <span>Video generation: {estimate.video} credits</span>
                        <span>Music: {estimate.music} credits</span>
                        <span>Assembly: {estimate.assembly} credits</span>
                        <strong>Total: {estimate.total} credits</strong>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={fetchEstimate}
                    className={styles.refreshEstimate}
                    disabled={isEstimating}
                  >
                    {isEstimating ? 'Calculating...' : 'Refresh Estimate'}
                  </button>
                </>
              ) : isProducing ? (
                <div className={styles.progressSection}>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${progress?.progress || 0}%` }}
                    />
                  </div>
                  <p className={styles.progressText}>{progress?.currentStep || 'Processing...'}</p>
                  <div className={styles.completedSteps}>
                    {progress?.completedSteps.map((step, i) => (
                      <span key={i} className={styles.completedStep}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {step}
                      </span>
                    ))}
                  </div>
                </div>
              ) : result?.videoUrl ? (
                <div className={styles.resultSection}>
                  <div className={styles.successIcon}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="16 8 10 14 8 12" />
                    </svg>
                  </div>
                  <h3>Episode Ready!</h3>
                  <video
                    src={result.videoUrl}
                    controls
                    className={styles.videoPreview}
                  />
                  <div className={styles.resultActions}>
                    <button onClick={handleDownload} className="btn btn-primary">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Download Video
                    </button>
                    <a href={result.videoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                      Open in New Tab
                    </a>
                  </div>
                </div>
              ) : result?.error ? (
                <div className={styles.errorSection}>
                  <div className={styles.errorIcon}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </div>
                  <h3>Production Failed</h3>
                  <p>{result.error}</p>
                  <button onClick={() => setResult(null)} className="btn btn-secondary">
                    Try Again
                  </button>
                </div>
              ) : null}
            </div>

            {!isProducing && !result?.videoUrl && (
              <div className={styles.modalFooter}>
                <button onClick={handleClose} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleProduce}
                  className="btn btn-primary"
                  disabled={!prompt.trim()}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Start Production
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

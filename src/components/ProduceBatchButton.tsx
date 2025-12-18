import { useState, useCallback } from 'react';
import styles from '@/styles/ProduceEpisode.module.css';

type ProductionType = 'series' | 'movie';

interface ProduceBatchButtonProps {
  projectId: string;
  projectName: string;
  disabled?: boolean;
}

interface EpisodeInput {
  episodeNumber: number;
  title: string;
  synopsis: string;
}

interface ActInput {
  actNumber: number;
  title: string;
  synopsis: string;
  duration: number;
}

interface BatchProgress {
  type: ProductionType;
  title: string;
  totalSegments: number;
  completedSegments: number;
  currentSegment?: string;
  overallProgress: number;
  segmentResults: Array<{
    segmentId: string;
    title: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    videoUrl?: string;
    error?: string;
  }>;
  errors: string[];
}

interface BatchResult {
  type: ProductionType;
  title: string;
  videos: Array<{
    segmentId: string;
    title: string;
    videoUrl: string;
    duration: number;
  }>;
  totalDuration: number;
  creditsUsed: number;
  error?: string;
}

export default function ProduceBatchButton({
  projectId,
  projectName,
  disabled = false,
}: ProduceBatchButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [productionType, setProductionType] = useState<ProductionType>('series');
  const [isProducing, setIsProducing] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  // Series form state
  const [seriesTitle, setSeriesTitle] = useState('');
  const [seriesSynopsis, setSeriesSynopsis] = useState('');
  const [seriesGenre, setSeriesGenre] = useState('drama');
  const [episodeDurationInput, setEpisodeDurationInput] = useState('60');
  const episodeDuration = episodeDurationInput === '' ? 0 : Number(episodeDurationInput);
  const [episodes, setEpisodes] = useState<EpisodeInput[]>([
    { episodeNumber: 1, title: 'Pilot', synopsis: '' },
  ]);

  // Movie form state
  const [movieTitle, setMovieTitle] = useState('');
  const [movieSynopsis, setMovieSynopsis] = useState('');
  const [movieGenre, setMovieGenre] = useState('drama');
  const [movieDurationInput, setMovieDurationInput] = useState('5');
  const movieDuration = movieDurationInput === '' ? 0 : Number(movieDurationInput);
  const [useCustomActs, setUseCustomActs] = useState(false);
  const [acts, setActs] = useState<ActInput[]>([
    { actNumber: 1, title: 'Setup', synopsis: '', duration: 1 },
    { actNumber: 2, title: 'Confrontation', synopsis: '', duration: 2 },
    { actNumber: 3, title: 'Resolution', synopsis: '', duration: 1 },
  ]);

  const addEpisode = useCallback(() => {
    if (episodes.length < 12) {
      setEpisodes(prev => [
        ...prev,
        {
          episodeNumber: prev.length + 1,
          title: `Episode ${prev.length + 1}`,
          synopsis: '',
        },
      ]);
    }
  }, [episodes.length]);

  const removeEpisode = useCallback((index: number) => {
    if (episodes.length > 1) {
      setEpisodes(prev => prev.filter((_, i) => i !== index).map((ep, i) => ({
        ...ep,
        episodeNumber: i + 1,
      })));
    }
  }, [episodes.length]);

  const updateEpisode = useCallback((index: number, field: keyof EpisodeInput, value: string | number) => {
    setEpisodes(prev => prev.map((ep, i) =>
      i === index ? { ...ep, [field]: value } : ep
    ));
  }, []);

  const fetchEstimate = useCallback(async () => {
    setIsEstimating(true);
    try {
      const body = productionType === 'series'
        ? {
            projectId,
            type: 'series',
            estimateOnly: true,
            seriesConfig: {
              title: seriesTitle || projectName,
              genre: seriesGenre,
              synopsis: seriesSynopsis,
              episodeCount: episodes.length,
              episodeDuration,
              episodes,
            },
          }
        : {
            projectId,
            type: 'movie',
            estimateOnly: true,
            movieConfig: {
              title: movieTitle || projectName,
              genre: movieGenre,
              synopsis: movieSynopsis,
              targetDuration: movieDuration,
              acts: useCustomActs ? acts : [],
            },
          };

      const response = await fetch('/api/produce-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (data.estimatedCredits) {
        setEstimate(data.estimatedCredits);
      }
    } catch (err) {
      console.error('Failed to fetch estimate:', err);
    } finally {
      setIsEstimating(false);
    }
  }, [
    projectId, productionType, seriesTitle, seriesSynopsis, seriesGenre, episodeDuration, episodes,
    movieTitle, movieSynopsis, movieGenre, movieDuration, useCustomActs, acts, projectName
  ]);

  const handleOpenModal = useCallback(() => {
    setShowModal(true);
    setResult(null);
    setError(null);
    setProgress(null);
    setSeriesTitle(projectName);
    setMovieTitle(projectName);
  }, [projectName]);

  const handleProduce = useCallback(async () => {
    setIsProducing(true);
    setError(null);
    setProgress(null);
    setResult(null);

    try {
      const body = productionType === 'series'
        ? {
            projectId,
            type: 'series',
            seriesConfig: {
              title: seriesTitle || projectName,
              genre: seriesGenre,
              synopsis: seriesSynopsis,
              episodeCount: episodes.length,
              episodeDuration,
              episodes: episodes.filter(ep => ep.title && ep.synopsis),
            },
          }
        : {
            projectId,
            type: 'movie',
            movieConfig: {
              title: movieTitle || projectName,
              genre: movieGenre,
              synopsis: movieSynopsis,
              targetDuration: movieDuration,
              acts: useCustomActs ? acts : [],
            },
          };

      const response = await fetch('/api/produce-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: data.type,
          title: data.title,
          videos: data.videos || [],
          totalDuration: data.totalDuration || 0,
          creditsUsed: data.creditsUsed || 0,
        });
        setProgress(data.progress);
      } else {
        setError(data.error || 'Production failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Production failed');
    } finally {
      setIsProducing(false);
    }
  }, [
    projectId, productionType, seriesTitle, seriesSynopsis, seriesGenre, episodeDuration, episodes,
    movieTitle, movieSynopsis, movieGenre, movieDuration, useCustomActs, acts, projectName
  ]);

  const handleClose = useCallback(() => {
    if (!isProducing) {
      setShowModal(false);
    }
  }, [isProducing]);

  const isFormValid = productionType === 'series'
    ? seriesTitle && seriesSynopsis && episodes.some(ep => ep.title && ep.synopsis)
    : movieTitle && movieSynopsis;

  return (
    <>
      <button
        onClick={handleOpenModal}
        className={`btn btn-secondary ${styles.produceButton}`}
        disabled={disabled}
        title="Produce Series or Movie"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
          <line x1="7" y1="2" x2="7" y2="22" />
          <line x1="17" y1="2" x2="17" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="2" y1="7" x2="7" y2="7" />
          <line x1="2" y1="17" x2="7" y2="17" />
          <line x1="17" y1="17" x2="22" y2="17" />
          <line x1="17" y1="7" x2="22" y2="7" />
        </svg>
        Series / Movie
      </button>

      {showModal && (
        <div className={styles.modalOverlay} onClick={handleClose}>
          <div className={`${styles.modal} ${styles.modalLarge}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Produce {productionType === 'series' ? 'Series' : 'Movie'}</h2>
              <button onClick={handleClose} className={styles.closeButton} disabled={isProducing}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.modalContent}>
              {!isProducing && !result ? (
                <>
                  {/* Type selector */}
                  <div className={styles.typeSelector}>
                    <button
                      className={`${styles.typeButton} ${productionType === 'series' ? styles.active : ''}`}
                      onClick={() => setProductionType('series')}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
                        <polyline points="17 2 12 7 7 2" />
                      </svg>
                      TV Series
                    </button>
                    <button
                      className={`${styles.typeButton} ${productionType === 'movie' ? styles.active : ''}`}
                      onClick={() => setProductionType('movie')}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                        <line x1="7" y1="2" x2="7" y2="22" />
                        <line x1="17" y1="2" x2="17" y2="22" />
                      </svg>
                      Movie
                    </button>
                  </div>

                  {productionType === 'series' ? (
                    <>
                      {/* Series form */}
                      <div className={styles.formGroup}>
                        <label htmlFor="seriesTitle">Series Title</label>
                        <input
                          id="seriesTitle"
                          type="text"
                          value={seriesTitle}
                          onChange={e => setSeriesTitle(e.target.value)}
                          placeholder="Enter series title"
                          className={styles.input}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label htmlFor="seriesSynopsis">Series Synopsis</label>
                        <textarea
                          id="seriesSynopsis"
                          value={seriesSynopsis}
                          onChange={e => setSeriesSynopsis(e.target.value)}
                          placeholder="Describe your series..."
                          rows={3}
                          className={styles.textarea}
                        />
                      </div>

                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <label htmlFor="seriesGenre">Genre</label>
                          <select
                            id="seriesGenre"
                            value={seriesGenre}
                            onChange={e => setSeriesGenre(e.target.value)}
                            className={styles.select}
                          >
                            <option value="drama">Drama</option>
                            <option value="action">Action</option>
                            <option value="comedy">Comedy</option>
                            <option value="thriller">Thriller</option>
                            <option value="sci-fi">Sci-Fi</option>
                            <option value="fantasy">Fantasy</option>
                            <option value="horror">Horror</option>
                            <option value="romance">Romance</option>
                          </select>
                        </div>

                        <div className={styles.formGroup}>
                          <label htmlFor="episodeDuration">Episode Duration (sec)</label>
                          <input
                            id="episodeDuration"
                            type="number"
                            min={30}
                            max={180}
                            value={episodeDurationInput}
                            onChange={e => setEpisodeDurationInput(e.target.value)}
                            onBlur={() => {
                              if (episodeDurationInput === '' || episodeDuration < 30) {
                                setEpisodeDurationInput('30');
                              }
                            }}
                            className={styles.input}
                          />
                        </div>
                      </div>

                      <div className={styles.episodeList}>
                        <div className={styles.episodeListHeader}>
                          <h4>Episodes ({episodes.length}/12)</h4>
                          <button
                            onClick={addEpisode}
                            className={styles.addButton}
                            disabled={episodes.length >= 12}
                          >
                            + Add Episode
                          </button>
                        </div>

                        {episodes.map((episode, index) => (
                          <div key={index} className={styles.episodeItem}>
                            <div className={styles.episodeHeader}>
                              <span className={styles.episodeNumber}>Ep {episode.episodeNumber}</span>
                              <input
                                type="text"
                                value={episode.title}
                                onChange={e => updateEpisode(index, 'title', e.target.value)}
                                placeholder="Episode title"
                                className={styles.episodeTitleInput}
                              />
                              {episodes.length > 1 && (
                                <button
                                  onClick={() => removeEpisode(index)}
                                  className={styles.removeButton}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            <textarea
                              value={episode.synopsis}
                              onChange={e => updateEpisode(index, 'synopsis', e.target.value)}
                              placeholder="Episode synopsis..."
                              rows={2}
                              className={styles.episodeSynopsis}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Movie form */}
                      <div className={styles.formGroup}>
                        <label htmlFor="movieTitle">Movie Title</label>
                        <input
                          id="movieTitle"
                          type="text"
                          value={movieTitle}
                          onChange={e => setMovieTitle(e.target.value)}
                          placeholder="Enter movie title"
                          className={styles.input}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label htmlFor="movieSynopsis">Movie Synopsis</label>
                        <textarea
                          id="movieSynopsis"
                          value={movieSynopsis}
                          onChange={e => setMovieSynopsis(e.target.value)}
                          placeholder="Describe your movie..."
                          rows={3}
                          className={styles.textarea}
                        />
                      </div>

                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <label htmlFor="movieGenre">Genre</label>
                          <select
                            id="movieGenre"
                            value={movieGenre}
                            onChange={e => setMovieGenre(e.target.value)}
                            className={styles.select}
                          >
                            <option value="drama">Drama</option>
                            <option value="action">Action</option>
                            <option value="comedy">Comedy</option>
                            <option value="thriller">Thriller</option>
                            <option value="sci-fi">Sci-Fi</option>
                            <option value="fantasy">Fantasy</option>
                            <option value="horror">Horror</option>
                            <option value="romance">Romance</option>
                          </select>
                        </div>

                        <div className={styles.formGroup}>
                          <label htmlFor="movieDuration">Duration (minutes)</label>
                          <input
                            id="movieDuration"
                            type="number"
                            min={1}
                            max={30}
                            value={movieDurationInput}
                            onChange={e => setMovieDurationInput(e.target.value)}
                            onBlur={() => {
                              if (movieDurationInput === '' || movieDuration < 1) {
                                setMovieDurationInput('1');
                              }
                            }}
                            className={styles.input}
                          />
                        </div>
                      </div>

                      <label className={styles.checkbox}>
                        <input
                          type="checkbox"
                          checked={useCustomActs}
                          onChange={e => setUseCustomActs(e.target.checked)}
                        />
                        Customize act structure (default: 3-act structure)
                      </label>

                      {useCustomActs && (
                        <div className={styles.actList}>
                          {acts.map((act, index) => (
                            <div key={index} className={styles.actItem}>
                              <span className={styles.actNumber}>Act {act.actNumber}</span>
                              <input
                                type="text"
                                value={act.title}
                                onChange={e => {
                                  const newActs = [...acts];
                                  newActs[index].title = e.target.value;
                                  setActs(newActs);
                                }}
                                placeholder="Act title"
                                className={styles.actTitleInput}
                              />
                              <input
                                type="number"
                                value={act.duration}
                                onChange={e => {
                                  const newActs = [...acts];
                                  newActs[index].duration = Number(e.target.value);
                                  setActs(newActs);
                                }}
                                min={1}
                                max={15}
                                className={styles.actDurationInput}
                              />
                              <span>min</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {estimate && (
                    <div className={styles.estimate}>
                      <h4>Estimated Cost</h4>
                      <strong>{estimate} credits</strong>
                    </div>
                  )}

                  <button
                    onClick={fetchEstimate}
                    className={styles.refreshEstimate}
                    disabled={isEstimating}
                  >
                    {isEstimating ? 'Calculating...' : 'Calculate Cost'}
                  </button>
                </>
              ) : isProducing ? (
                <div className={styles.progressSection}>
                  <h3>Producing {productionType === 'series' ? 'Series' : 'Movie'}...</h3>
                  <p className={styles.progressText}>
                    This may take several minutes. Please keep this window open.
                  </p>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${progress?.overallProgress || 0}%` }}
                    />
                  </div>
                  {progress?.currentSegment && (
                    <p className={styles.currentSegment}>
                      Currently producing: {progress.currentSegment}
                    </p>
                  )}
                  {progress?.segmentResults && (
                    <div className={styles.segmentList}>
                      {progress.segmentResults.map((segment, i) => (
                        <div key={i} className={`${styles.segmentItem} ${styles[segment.status]}`}>
                          <span className={styles.segmentStatus}>
                            {segment.status === 'completed' ? '✓' :
                             segment.status === 'processing' ? '...' :
                             segment.status === 'failed' ? '✗' : '○'}
                          </span>
                          {segment.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : result ? (
                <div className={styles.resultSection}>
                  <div className={styles.successIcon}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="16 8 10 14 8 12" />
                    </svg>
                  </div>
                  <h3>{result.title} Complete!</h3>
                  <p>
                    {result.videos.length} {productionType === 'series' ? 'episodes' : 'acts'} produced
                    ({Math.round(result.totalDuration / 60)} minutes total)
                  </p>
                  <p>Credits used: {result.creditsUsed}</p>

                  <div className={styles.videoList}>
                    {result.videos.map((video, i) => (
                      <div key={i} className={styles.videoItem}>
                        <span className={styles.videoTitle}>{video.title}</span>
                        <a
                          href={video.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                        >
                          Watch
                        </a>
                        <a
                          href={video.videoUrl}
                          download={`${video.title.replace(/[^a-z0-9]/gi, '_')}.mp4`}
                          className="btn btn-primary btn-sm"
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ) : error ? (
                <div className={styles.errorSection}>
                  <div className={styles.errorIcon}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </div>
                  <h3>Production Failed</h3>
                  <p>{error}</p>
                  <button onClick={() => setError(null)} className="btn btn-secondary">
                    Try Again
                  </button>
                </div>
              ) : null}
            </div>

            {!isProducing && !result && !error && (
              <div className={styles.modalFooter}>
                <button onClick={handleClose} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleProduce}
                  className="btn btn-primary"
                  disabled={!isFormValid}
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

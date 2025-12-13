import { useState, useRef, useEffect } from 'react';
import styles from './MusicPanel.module.css';

interface MusicPanelProps {
  onMusicGenerated?: (audioUrl: string) => void;
  sceneTitle?: string;
  projectId?: string;
  sequenceId?: string;
  initialPrompt?: string;
}

// Valid genres from the API
const GENRES = [
  { id: 'ambient', name: 'Ambient', description: 'Atmospheric soundscapes' },
  { id: 'cinematic', name: 'Cinematic', description: 'Epic film scores' },
  { id: 'classical', name: 'Classical', description: 'Orchestral compositions' },
  { id: 'electronic', name: 'Electronic', description: 'Synth-driven sounds' },
  { id: 'folk', name: 'Folk', description: 'Acoustic and traditional' },
  { id: 'hip-hop', name: 'Hip-Hop', description: 'Beat-driven rhythms' },
  { id: 'jazz', name: 'Jazz', description: 'Smooth improvisations' },
  { id: 'lo-fi', name: 'Lo-Fi', description: 'Chill beats' },
  { id: 'orchestral', name: 'Orchestral', description: 'Full symphony' },
  { id: 'pop', name: 'Pop', description: 'Catchy melodies' },
  { id: 'rock', name: 'Rock', description: 'Guitar-driven energy' },
  { id: 'synthwave', name: 'Synthwave', description: '80s retro vibes' },
  { id: 'world', name: 'World', description: 'Global influences' },
] as const;

const MOODS = [
  { id: 'calm', name: 'Calm', description: 'Peaceful and serene' },
  { id: 'dark', name: 'Dark', description: 'Ominous and foreboding' },
  { id: 'dramatic', name: 'Dramatic', description: 'Intense and powerful' },
  { id: 'energetic', name: 'Energetic', description: 'High energy' },
  { id: 'happy', name: 'Happy', description: 'Upbeat and cheerful' },
  { id: 'hopeful', name: 'Hopeful', description: 'Optimistic' },
  { id: 'intense', name: 'Intense', description: 'Building tension' },
  { id: 'melancholic', name: 'Melancholic', description: 'Sad and reflective' },
  { id: 'mysterious', name: 'Mysterious', description: 'Enigmatic' },
  { id: 'peaceful', name: 'Peaceful', description: 'Tranquil' },
  { id: 'romantic', name: 'Romantic', description: 'Love and passion' },
  { id: 'tense', name: 'Tense', description: 'Suspenseful' },
  { id: 'uplifting', name: 'Uplifting', description: 'Inspiring' },
] as const;

const TEMPOS = [
  { id: 'slow', name: 'Slow', bpm: '60-80 BPM' },
  { id: 'moderate', name: 'Moderate', bpm: '80-120 BPM' },
  { id: 'fast', name: 'Fast', bpm: '120-160 BPM' },
  { id: 'very fast', name: 'Very Fast', bpm: '160+ BPM' },
] as const;

type Genre = (typeof GENRES)[number]['id'];
type Mood = (typeof MOODS)[number]['id'];
type Tempo = (typeof TEMPOS)[number]['id'];

const MUSIC_CREDIT_COST = 5;

export default function MusicPanel({
  onMusicGenerated,
  sceneTitle,
  initialPrompt = '',
}: MusicPanelProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [selectedGenre, setSelectedGenre] = useState<Genre>('cinematic');
  const [selectedMood, setSelectedMood] = useState<Mood>('dramatic');
  const [selectedTempo, setSelectedTempo] = useState<Tempo>('moderate');
  const [duration, setDuration] = useState(10);
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setPrompt(initialPrompt);
  }, [initialPrompt]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a description for the music');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress('Starting music generation...');

    try {
      const response = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          genre: selectedGenre,
          mood: selectedMood,
          tempo: selectedTempo,
          duration,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate music');
      }

      // Handle async processing
      if (result.status === 'processing') {
        setProgress('Music is being generated... This may take up to 90 seconds.');
        // Poll for completion
        await pollForCompletion(result.predictionId);
      } else if (result.status === 'completed' && result.audioUrl) {
        setGeneratedAudioUrl(result.audioUrl);
        onMusicGenerated?.(result.audioUrl);
        setProgress(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate music');
      setProgress(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const pollForCompletion = async (predictionId: string) => {
    const maxAttempts = 45; // 90 seconds total (2s intervals)
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      try {
        // Re-check by calling the API with the same parameters
        // In a real implementation, you'd have a status endpoint
        // For now, we'll show progress and rely on the initial response
        setProgress(`Generating music... (${Math.round((attempts / maxAttempts) * 100)}%)`);
      } catch {
        // Continue polling
      }
    }

    setError('Music generation timed out. Please try again.');
    setProgress(null);
  };

  const handlePlayPause = () => {
    if (!generatedAudioUrl || !audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const getGenreEmoji = (genre: Genre): string => {
    const emojis: Record<Genre, string> = {
      ambient: '🌊',
      cinematic: '🎬',
      classical: '🎻',
      electronic: '🎹',
      folk: '🪕',
      'hip-hop': '🎤',
      jazz: '🎷',
      'lo-fi': '☕',
      orchestral: '🎼',
      pop: '🎵',
      rock: '🎸',
      synthwave: '🌆',
      world: '🌍',
    };
    return emojis[genre] || '🎵';
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.icon}>🎵</span>
          <h3 className={styles.title}>AI Music</h3>
          {sceneTitle && <span className={styles.sceneTag}>{sceneTitle}</span>}
        </div>
        <button
          className={styles.settingsBtn}
          onClick={() => setShowSettings(!showSettings)}
          title="Music settings"
        >
          ⚙️
        </button>
      </div>

      {showSettings && (
        <div className={styles.settings}>
          <div className={styles.settingRow}>
            <label>Genre:</label>
            <select
              value={selectedGenre}
              onChange={e => setSelectedGenre(e.target.value as Genre)}
              className={styles.select}
            >
              {GENRES.map(g => (
                <option key={g.id} value={g.id}>
                  {getGenreEmoji(g.id)} {g.name} - {g.description}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.settingRow}>
            <label>Mood:</label>
            <select
              value={selectedMood}
              onChange={e => setSelectedMood(e.target.value as Mood)}
              className={styles.select}
            >
              {MOODS.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} - {m.description}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.settingRow}>
            <label>Tempo:</label>
            <select
              value={selectedTempo}
              onChange={e => setSelectedTempo(e.target.value as Tempo)}
              className={styles.select}
            >
              {TEMPOS.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.bpm})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.settingRow}>
            <label>Duration: {duration}s</label>
            <input
              type="range"
              min="5"
              max="30"
              step="5"
              value={duration}
              onChange={e => setDuration(parseInt(e.target.value))}
              className={styles.slider}
            />
          </div>
        </div>
      )}

      <div className={styles.textArea}>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the music you want... e.g., 'Epic orchestral battle theme with rising strings and powerful brass'"
          rows={3}
          className={styles.textarea}
          disabled={isGenerating}
        />
        <div className={styles.textMeta}>
          <span>
            {getGenreEmoji(selectedGenre)} {selectedGenre} • {selectedMood} • {selectedTempo}
          </span>
          <span>{duration} seconds</span>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {progress && <p className={styles.progress}>{progress}</p>}

      {generatedAudioUrl && (
        <div className={styles.audioPlayer}>
          <audio
            ref={audioRef}
            src={generatedAudioUrl}
            onEnded={() => setIsPlaying(false)}
            onError={() => setError('Failed to load audio')}
          />
          <div className={styles.audioControls}>
            <button
              className={`${styles.playBtn} ${styles.primary}`}
              onClick={handlePlayPause}
            >
              {isPlaying ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                  Pause
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Play
                </>
              )}
            </button>
            <button className={styles.stopBtn} onClick={handleStop}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
              Stop
            </button>
            <a
              href={generatedAudioUrl}
              download={`music-${Date.now()}.mp3`}
              className={styles.downloadBtn}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download
            </a>
          </div>
        </div>
      )}

      <div className={styles.controls}>
        <button
          className={`${styles.generateBtn} ${styles.primary}`}
          onClick={handleGenerate}
          disabled={!prompt.trim() || isGenerating}
        >
          {isGenerating ? (
            <>
              <span className={styles.spinner} />
              Generating...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              Generate Music ({MUSIC_CREDIT_COST} credits)
            </>
          )}
        </button>
      </div>

      <p className={styles.hint}>
        AI music generation uses MusicGen to create unique soundtracks.
        Describe the style, instruments, and mood you want.
      </p>
    </div>
  );
}

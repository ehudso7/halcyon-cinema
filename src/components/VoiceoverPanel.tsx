import { useState, useEffect, useRef } from 'react';
import styles from './VoiceoverPanel.module.css';

interface VoiceoverPanelProps {
  text: string;
  onTextChange?: (text: string) => void;
  sceneTitle?: string;
}

interface VoiceOption {
  voice: SpeechSynthesisVoice;
  name: string;
  lang: string;
}

export default function VoiceoverPanel({ text, onTextChange, sceneTitle }: VoiceoverPanelProps) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<number>(0);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [editableText, setEditableText] = useState(text);
  const [showSettings, setShowSettings] = useState(false);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;

      const loadVoices = () => {
        const availableVoices = synthRef.current?.getVoices() || [];
        const voiceOptions = availableVoices.map(voice => ({
          voice,
          name: voice.name,
          lang: voice.lang,
        }));
        setVoices(voiceOptions);

        // Try to select a good default English voice
        const englishIndex = voiceOptions.findIndex(v =>
          v.lang.startsWith('en') && v.name.toLowerCase().includes('natural')
        );
        if (englishIndex >= 0) {
          setSelectedVoice(englishIndex);
        }
      };

      // Chrome requires waiting for voiceschanged
      if (synthRef.current.onvoiceschanged !== undefined) {
        synthRef.current.onvoiceschanged = loadVoices;
      }
      loadVoices();
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  useEffect(() => {
    setEditableText(text);
  }, [text]);

  const handlePlay = () => {
    if (!synthRef.current || !editableText.trim()) return;

    if (isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    // Cancel any existing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(editableText);
    utterance.voice = voices[selectedVoice]?.voice || null;
    utterance.rate = rate;
    utterance.pitch = pitch;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const handlePause = () => {
    if (synthRef.current && isPlaying) {
      synthRef.current.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  const handleTextChange = (newText: string) => {
    setEditableText(newText);
    if (onTextChange) {
      onTextChange(newText);
    }
  };

  const estimateDuration = () => {
    // Average speaking rate is ~150 words per minute
    const wordCount = editableText.trim().split(/\s+/).length;
    const seconds = Math.ceil((wordCount / 150) * 60 / rate);
    return `~${seconds}s`;
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.icon}>🎙️</span>
          <h3 className={styles.title}>Voiceover</h3>
          {sceneTitle && <span className={styles.sceneTag}>{sceneTitle}</span>}
        </div>
        <button
          className={styles.settingsBtn}
          onClick={() => setShowSettings(!showSettings)}
          title="Voice settings"
        >
          ⚙️
        </button>
      </div>

      {showSettings && (
        <div className={styles.settings}>
          <div className={styles.settingRow}>
            <label>Voice:</label>
            <select
              value={selectedVoice}
              onChange={e => setSelectedVoice(Number(e.target.value))}
              className={styles.select}
            >
              {voices.map((v, i) => (
                <option key={i} value={i}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.settingRow}>
            <label>Speed: {rate.toFixed(1)}x</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={rate}
              onChange={e => setRate(parseFloat(e.target.value))}
              className={styles.slider}
            />
          </div>

          <div className={styles.settingRow}>
            <label>Pitch: {pitch.toFixed(1)}</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={pitch}
              onChange={e => setPitch(parseFloat(e.target.value))}
              className={styles.slider}
            />
          </div>
        </div>
      )}

      <div className={styles.textArea}>
        <textarea
          value={editableText}
          onChange={e => handleTextChange(e.target.value)}
          placeholder="Enter narration text here..."
          rows={4}
          className={styles.textarea}
        />
        <div className={styles.textMeta}>
          <span>{editableText.trim().split(/\s+/).filter(Boolean).length} words</span>
          <span>Est. duration: {estimateDuration()}</span>
        </div>
      </div>

      <div className={styles.controls}>
        {!isPlaying ? (
          <button
            className={`${styles.playBtn} ${styles.primary}`}
            onClick={handlePlay}
            disabled={!editableText.trim()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {isPaused ? 'Resume' : 'Play'}
          </button>
        ) : (
          <button className={styles.playBtn} onClick={handlePause}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
            Pause
          </button>
        )}

        <button
          className={styles.stopBtn}
          onClick={handleStop}
          disabled={!isPlaying && !isPaused}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
          Stop
        </button>

        {isPlaying && (
          <div className={styles.playingIndicator}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}
      </div>

      <p className={styles.hint}>
        Using Web Speech API for preview. For production-quality voiceovers, connect an external audio API.
      </p>
    </div>
  );
}

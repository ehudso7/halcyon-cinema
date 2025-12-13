import { useState, useEffect, useRef } from 'react';
import { MicrophoneIcon, CogIcon } from './Icons';
import styles from './VoiceoverPanel.module.css';

interface VoiceoverPanelProps {
  text: string;
  onTextChange?: (text: string) => void;
  onVoiceoverGenerated?: (audioUrl: string) => void;
  sceneTitle?: string;
  projectId?: string;
  sceneId?: string;
}

// OpenAI TTS voices
const AI_VOICES = [
  { id: 'nova', name: 'Nova', description: 'Warm and friendly female voice' },
  { id: 'alloy', name: 'Alloy', description: 'Balanced and versatile' },
  { id: 'echo', name: 'Echo', description: 'Clear and precise male voice' },
  { id: 'fable', name: 'Fable', description: 'Expressive British voice' },
  { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative male voice' },
  { id: 'shimmer', name: 'Shimmer', description: 'Soft and gentle female voice' },
] as const;

type AIVoice = (typeof AI_VOICES)[number]['id'];

export default function VoiceoverPanel({
  text,
  onTextChange,
  onVoiceoverGenerated,
  sceneTitle,
  projectId,
  sceneId,
}: VoiceoverPanelProps) {
  const [editableText, setEditableText] = useState(text);
  const [selectedVoice, setSelectedVoice] = useState<AIVoice>('nova');
  const [speed, setSpeed] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usePreview, setUsePreview] = useState(false);
  const [creditsRequired, setCreditsRequired] = useState(2);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Initialize browser speech synthesis for preview
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
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

  // Calculate credits based on text length
  useEffect(() => {
    const chars = editableText.trim().length;
    setCreditsRequired(Math.max(1, Math.ceil((chars / 1000) * 2)));
  }, [editableText]);

  const handleTextChange = (newText: string) => {
    setEditableText(newText);
    onTextChange?.(newText);
    // Clear generated audio when text changes
    setGeneratedAudioUrl(null);
  };

  const handlePreview = () => {
    if (!synthRef.current || !editableText.trim()) return;

    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(editableText);
    utterance.rate = speed;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    synthRef.current.speak(utterance);
  };

  const handleGenerate = async () => {
    if (!editableText.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: editableText.trim(),
          voice: selectedVoice,
          model: 'tts-1-hd',
          speed,
          projectId,
          sceneId,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate voiceover');
      }

      setGeneratedAudioUrl(result.audioUrl);
      onVoiceoverGenerated?.(result.audioUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate voiceover');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayGenerated = () => {
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
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const estimateDuration = () => {
    const chars = editableText.trim().length;
    const seconds = Math.ceil((chars / 750) * 60 / speed);
    return `~${seconds}s`;
  };

  const wordCount = editableText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.icon}><MicrophoneIcon size={20} /></span>
          <h3 className={styles.title}>AI Voiceover</h3>
          {sceneTitle && <span className={styles.sceneTag}>{sceneTitle}</span>}
        </div>
        <button
          className={styles.settingsBtn}
          onClick={() => setShowSettings(!showSettings)}
          title="Voice settings"
          aria-label="Voice settings"
        >
          <CogIcon size={18} />
        </button>
      </div>

      {showSettings && (
        <div className={styles.settings}>
          <div className={styles.settingRow}>
            <label>Voice:</label>
            <select
              value={selectedVoice}
              onChange={e => setSelectedVoice(e.target.value as AIVoice)}
              className={styles.select}
            >
              {AI_VOICES.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} - {v.description}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.settingRow}>
            <label>Speed: {speed.toFixed(1)}x</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
              className={styles.slider}
            />
          </div>

          <div className={styles.settingRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={usePreview}
                onChange={e => setUsePreview(e.target.checked)}
              />
              <span>Use browser preview (free, lower quality)</span>
            </label>
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
          disabled={isGenerating}
        />
        <div className={styles.textMeta}>
          <span>{wordCount} words • {editableText.trim().length} chars</span>
          <span>Est. duration: {estimateDuration()}</span>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

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
              onClick={handlePlayGenerated}
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
            <a
              href={generatedAudioUrl}
              download={`voiceover-${sceneId || 'scene'}.mp3`}
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
        {usePreview ? (
          <button
            className={`${styles.playBtn} ${styles.primary}`}
            onClick={handlePreview}
            disabled={!editableText.trim() || isGenerating}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Preview
          </button>
        ) : (
          <button
            className={`${styles.playBtn} ${styles.primary}`}
            onClick={handleGenerate}
            disabled={!editableText.trim() || isGenerating}
          >
            {isGenerating ? (
              <>
                <span className={styles.spinner} />
                Generating...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Generate ({creditsRequired} credit{creditsRequired !== 1 ? 's' : ''})
              </>
            )}
          </button>
        )}

        <button
          className={styles.stopBtn}
          onClick={handleStop}
          disabled={!isPlaying}
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
        {usePreview
          ? 'Browser preview is free but lower quality. Uncheck "Use browser preview" in settings for AI-generated audio.'
          : 'Using OpenAI TTS for high-quality voiceovers. Check "Use browser preview" in settings for free preview.'}
      </p>
    </div>
  );
}

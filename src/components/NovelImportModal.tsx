import { useState, useEffect, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import {
  DocumentIcon,
  UsersIcon,
  FilmIcon,
  BookIcon,
  SparklesIcon,
  CheckCircleIcon,
  LocationIcon,
  UploadIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from './Icons';
import styles from './NovelImportModal.module.css';

// Types
interface DetectedChapter {
  index: number;
  title: string;
  startIndex: number;
  endIndex: number;
  wordCount: number;
  preview: string;
  type: 'prologue' | 'chapter' | 'epilogue' | 'interlude' | 'part';
  selected: boolean;
}

interface DetectedAct {
  number: number;
  title: string;
  startChapter: number;
  endChapter: number;
}

interface ExtractedCharacter {
  id: string;
  name: string;
  description: string;
  traits: string[];
  role: string;
  firstChapter: number;
  appearances: number[];
  selected: boolean;
}

interface ExtractedLocation {
  id: string;
  name: string;
  description: string;
  significance: string;
  firstChapter: number;
  appearances: number[];
  selected: boolean;
}

interface ExtractedScene {
  id: string;
  chapterIndex: number;
  title: string;
  description: string;
  visualPrompt: string;
  sceneType: string;
  emotionalBeat: string;
  characters: string[];
  location: string;
  selected: boolean;
}

interface ExtractedLore {
  id: string;
  name: string;
  description: string;
  type: string;
  chapterIndex: number;
  selected: boolean;
}

interface ChapterAnalysis {
  index: number;
  title: string;
  summary: string;
  characters: ExtractedCharacter[];
  locations: ExtractedLocation[];
  scenes: ExtractedScene[];
  lore: ExtractedLore[];
  emotionalArc: string;
  pacing: string;
  analyzed: boolean;
}

type WizardStep = 'upload' | 'chapters' | 'analyzing' | 'review' | 'configure' | 'generating';

const GENRES = [
  { value: 'cinematic-realism', label: 'Cinematic Realism' },
  { value: 'film-noir', label: 'Film Noir' },
  { value: 'sci-fi', label: 'Science Fiction' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'anime', label: 'Anime' },
  { value: 'horror', label: 'Horror' },
  { value: 'western', label: 'Western' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'thriller', label: 'Thriller' },
  { value: 'romance', label: 'Romance' },
  { value: 'a24-indie', label: 'A24 Indie' },
];

const VISUAL_STYLES = [
  { value: 'photorealistic', label: 'Photorealistic' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'painterly', label: 'Painterly' },
  { value: 'concept-art', label: 'Concept Art' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'noir', label: 'Noir' },
];

interface NovelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: NovelImportData) => Promise<void>;
}

export interface NovelImportData {
  title: string;
  description: string;
  content: string;
  chapters: { title: string; content: string }[];
  characters: ExtractedCharacter[];
  locations: ExtractedLocation[];
  lore: ExtractedLore[];
  scenes: ExtractedScene[];
  genre: string;
  visualStyle: string;
  generateSceneImages: boolean;
  generateCharacterPortraits: boolean;
  generateLocationArt: boolean;
}

export default function NovelImportModal({ isOpen, onClose, onComplete }: NovelImportModalProps) {
  // Wizard state
  const [step, setStep] = useState<WizardStep>('upload');
  const [error, setError] = useState('');

  // Upload state
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chapter detection state
  const [novelTitle, setNovelTitle] = useState('');
  const [chapters, setChapters] = useState<DetectedChapter[]>([]);
  const [acts, setActs] = useState<DetectedAct[]>([]);
  const [totalWordCount, setTotalWordCount] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);

  // Analysis state
  const [chapterAnalyses, setChapterAnalyses] = useState<ChapterAnalysis[]>([]);
  const [analyzingIndex, setAnalyzingIndex] = useState(-1);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  // Aggregated extracted content
  const [allCharacters, setAllCharacters] = useState<ExtractedCharacter[]>([]);
  const [allLocations, setAllLocations] = useState<ExtractedLocation[]>([]);
  const [allScenes, setAllScenes] = useState<ExtractedScene[]>([]);
  const [allLore, setAllLore] = useState<ExtractedLore[]>([]);

  // Configuration state
  const [genre, setGenre] = useState('cinematic-realism');
  const [visualStyle, setVisualStyle] = useState('cinematic');
  const [generateSceneImages, setGenerateSceneImages] = useState(true);
  const [generateCharacterPortraits, setGenerateCharacterPortraits] = useState(true);
  const [generateLocationArt, setGenerateLocationArt] = useState(false);

  // Review tab state
  const [reviewTab, setReviewTab] = useState<'characters' | 'locations' | 'scenes' | 'lore'>('characters');

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('upload');
      setContent('');
      setFilename('');
      setNovelTitle('');
      setChapters([]);
      setActs([]);
      setChapterAnalyses([]);
      setAllCharacters([]);
      setAllLocations([]);
      setAllScenes([]);
      setAllLore([]);
      setError('');
      setAnalyzingIndex(-1);
      setAnalysisProgress(0);
    }
  }, [isOpen]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/import/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload file');
      }

      const data = await response.json();
      setContent(data.content);
      setFilename(data.filename);
      setTotalWordCount(data.wordCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Detect chapters
  const detectChapters = async () => {
    if (!content.trim()) {
      setError('Please upload or paste your novel content first');
      return;
    }

    setIsDetecting(true);
    setError('');

    try {
      const response = await fetch('/api/import/detect-chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to detect chapters');
      }

      const data = await response.json();
      setNovelTitle(data.title || 'Untitled Novel');
      setChapters(data.chapters.map((ch: DetectedChapter) => ({ ...ch, selected: true })));
      setActs(data.acts || []);
      setTotalWordCount(data.totalWordCount);
      setStep('chapters');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect chapters');
    } finally {
      setIsDetecting(false);
    }
  };

  // Analyze chapters
  const analyzeChapters = async () => {
    const selectedChapters = chapters.filter(ch => ch.selected);
    if (selectedChapters.length === 0) {
      setError('Please select at least one chapter to analyze');
      return;
    }

    setStep('analyzing');
    setAnalyzingIndex(0);
    setAnalysisProgress(0);

    const analyses: ChapterAnalysis[] = [];
    const accumulatedCharacters: Map<string, ExtractedCharacter> = new Map();
    const accumulatedLocations: Map<string, ExtractedLocation> = new Map();
    const accumulatedScenes: ExtractedScene[] = [];
    const accumulatedLore: ExtractedLore[] = [];

    for (let i = 0; i < selectedChapters.length; i++) {
      const chapter = selectedChapters[i];
      setAnalyzingIndex(i);
      setAnalysisProgress((i / selectedChapters.length) * 100);

      try {
        const chapterContent = content.substring(chapter.startIndex, chapter.endIndex);

        const response = await fetch('/api/import/analyze-chapter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: chapterContent,
            chapterIndex: chapter.index,
            chapterTitle: chapter.title,
            previousCharacters: Array.from(accumulatedCharacters.values()),
            previousLocations: Array.from(accumulatedLocations.values()),
            // Limit context to last 3 chapters to avoid token limits
            novelContext: analyses.length > 0
              ? `Previous chapters summary: ${analyses.slice(-3).map(a => a.summary).join(' ')}`
              : '',
          }),
        });

        if (!response.ok) {
          console.error(`Failed to analyze chapter ${chapter.index}`);
          continue;
        }

        const data = await response.json();

        // Process characters
        const chapterCharacters: ExtractedCharacter[] = (data.characters || []).map(
          (c: ExtractedCharacter, idx: number) => {
            const id = `char-${chapter.index}-${idx}`;
            const existing = accumulatedCharacters.get(c.name.toLowerCase());
            if (existing) {
              existing.appearances.push(chapter.index);
              if (c.description && c.description.length > existing.description.length) {
                existing.description = c.description;
              }
              return existing;
            }
            const newChar: ExtractedCharacter = {
              ...c,
              id,
              firstChapter: chapter.index,
              appearances: [chapter.index],
              selected: true,
            };
            accumulatedCharacters.set(c.name.toLowerCase(), newChar);
            return newChar;
          }
        );

        // Process locations
        const chapterLocations: ExtractedLocation[] = (data.locations || []).map(
          (l: ExtractedLocation, idx: number) => {
            const id = `loc-${chapter.index}-${idx}`;
            const existing = accumulatedLocations.get(l.name.toLowerCase());
            if (existing) {
              existing.appearances.push(chapter.index);
              return existing;
            }
            const newLoc: ExtractedLocation = {
              ...l,
              id,
              firstChapter: chapter.index,
              appearances: [chapter.index],
              selected: true,
            };
            accumulatedLocations.set(l.name.toLowerCase(), newLoc);
            return newLoc;
          }
        );

        // Process scenes
        const chapterScenes: ExtractedScene[] = (data.scenes || []).map(
          (s: ExtractedScene, idx: number) => ({
            ...s,
            id: `scene-${chapter.index}-${idx}`,
            chapterIndex: chapter.index,
            selected: true,
          })
        );
        accumulatedScenes.push(...chapterScenes);

        // Process lore
        const chapterLore: ExtractedLore[] = (data.lore || []).map(
          (l: ExtractedLore, idx: number) => ({
            ...l,
            id: `lore-${chapter.index}-${idx}`,
            chapterIndex: chapter.index,
            selected: true,
          })
        );
        accumulatedLore.push(...chapterLore);

        analyses.push({
          index: chapter.index,
          title: chapter.title,
          summary: data.summary || '',
          characters: chapterCharacters,
          locations: chapterLocations,
          scenes: chapterScenes,
          lore: chapterLore,
          emotionalArc: data.emotionalArc || '',
          pacing: data.pacing || 'moderate',
          analyzed: true,
        });
      } catch (err) {
        console.error(`Error analyzing chapter ${chapter.index}:`, err);
      }

      // Small delay between chapters to avoid rate limits
      if (i < selectedChapters.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setChapterAnalyses(analyses);
    setAllCharacters(Array.from(accumulatedCharacters.values()));
    setAllLocations(Array.from(accumulatedLocations.values()));
    setAllScenes(accumulatedScenes);
    setAllLore(accumulatedLore);
    setAnalysisProgress(100);
    setStep('review');
  };

  // Toggle selection helpers
  const toggleCharacter = (id: string) => {
    setAllCharacters(chars => chars.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  };

  const toggleLocation = (id: string) => {
    setAllLocations(locs => locs.map(l => l.id === id ? { ...l, selected: !l.selected } : l));
  };

  const toggleScene = (id: string) => {
    setAllScenes(scenes => scenes.map(s => s.id === id ? { ...s, selected: !s.selected } : s));
  };

  const toggleLore = (id: string) => {
    setAllLore(lore => lore.map(l => l.id === id ? { ...l, selected: !l.selected } : l));
  };

  const selectAll = (category: 'characters' | 'locations' | 'scenes' | 'lore', value: boolean) => {
    switch (category) {
      case 'characters':
        setAllCharacters(chars => chars.map(c => ({ ...c, selected: value })));
        break;
      case 'locations':
        setAllLocations(locs => locs.map(l => ({ ...l, selected: value })));
        break;
      case 'scenes':
        setAllScenes(scenes => scenes.map(s => ({ ...s, selected: value })));
        break;
      case 'lore':
        setAllLore(lore => lore.map(l => ({ ...l, selected: value })));
        break;
    }
  };

  // Handle final submission
  const handleComplete = async () => {
    setStep('generating');
    setError('');

    const selectedChapterContents = chapters
      .filter(ch => ch.selected)
      .map(ch => ({
        title: ch.title,
        content: content.substring(ch.startIndex, ch.endIndex),
      }));

    const data: NovelImportData = {
      title: novelTitle,
      description: chapterAnalyses.map(a => a.summary).join(' ').substring(0, 500),
      content,
      chapters: selectedChapterContents,
      characters: allCharacters.filter(c => c.selected),
      locations: allLocations.filter(l => l.selected),
      lore: allLore.filter(l => l.selected),
      scenes: allScenes.filter(s => s.selected),
      genre,
      visualStyle,
      generateSceneImages,
      generateCharacterPortraits,
      generateLocationArt,
    };

    try {
      await onComplete(data);
    } catch (err) {
      console.error('Novel import completion error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setStep('configure'); // Return to configure step on error
    }
  };

  const handleClose = () => {
    if (step !== 'analyzing' && step !== 'generating') {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Calculate credits estimate
  const selectedSceneCount = allScenes.filter(s => s.selected).length;
  const selectedCharacterCount = allCharacters.filter(c => c.selected).length;
  const selectedLocationCount = allLocations.filter(l => l.selected).length;

  const creditsEstimate =
    (generateSceneImages ? selectedSceneCount * 10 : 0) +
    (generateCharacterPortraits ? selectedCharacterCount * 10 : 0) +
    (generateLocationArt ? selectedLocationCount * 10 : 0);

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header with steps */}
        <div className={styles.header}>
          <div className={styles.stepIndicator}>
            <div className={`${styles.stepDot} ${step === 'upload' ? styles.active : ''} ${['chapters', 'analyzing', 'review', 'configure', 'generating'].includes(step) ? styles.completed : ''}`}>
              <UploadIcon size={16} />
            </div>
            <div className={styles.stepLine} />
            <div className={`${styles.stepDot} ${step === 'chapters' ? styles.active : ''} ${['analyzing', 'review', 'configure', 'generating'].includes(step) ? styles.completed : ''}`}>
              <BookIcon size={16} />
            </div>
            <div className={styles.stepLine} />
            <div className={`${styles.stepDot} ${step === 'analyzing' ? styles.active : ''} ${['review', 'configure', 'generating'].includes(step) ? styles.completed : ''}`}>
              <SparklesIcon size={16} />
            </div>
            <div className={styles.stepLine} />
            <div className={`${styles.stepDot} ${step === 'review' || step === 'configure' ? styles.active : ''} ${step === 'generating' ? styles.completed : ''}`}>
              <CheckCircleIcon size={16} />
            </div>
          </div>
          <button className={styles.closeButton} onClick={handleClose} disabled={step === 'analyzing' || step === 'generating'}>
            ✕
          </button>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className={styles.content}>
            <div className={styles.titleSection}>
              <h2>Import Your Novel</h2>
              <p>Upload your manuscript or paste the text to get started</p>
            </div>

            <div
              className={`${styles.dropZone} ${isUploading ? styles.uploading : ''}`}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.docx,.pdf,.epub"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              {isUploading ? (
                <>
                  <div className={styles.spinner} />
                  <p>Processing file...</p>
                </>
              ) : filename ? (
                <>
                  <DocumentIcon size={48} color="#10b981" />
                  <p className={styles.filename}>{filename}</p>
                  <p className={styles.wordCount}>{totalWordCount.toLocaleString()} words</p>
                  <button className={styles.changeFile}>Change file</button>
                </>
              ) : (
                <>
                  <UploadIcon size={48} color="#6366f1" />
                  <p>Drop your manuscript here</p>
                  <p className={styles.supportedFormats}>.docx, .pdf, .epub, .txt</p>
                  <span className={styles.orDivider}>or click to browse</span>
                </>
              )}
            </div>

            <div className={styles.pasteSection}>
              <div className={styles.divider}>
                <span>or paste your text</span>
              </div>
              <textarea
                value={content}
                onChange={e => {
                  setContent(e.target.value);
                  setFilename('');
                  setTotalWordCount(e.target.value.split(/\s+/).filter(w => w).length);
                }}
                placeholder="Paste your novel content here..."
                className={styles.pasteArea}
                rows={8}
              />
              {content && !filename && (
                <p className={styles.wordCount}>{totalWordCount.toLocaleString()} words</p>
              )}
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={handleClose}>Cancel</button>
              <button
                className={styles.primaryBtn}
                onClick={detectChapters}
                disabled={!content.trim() || isDetecting}
              >
                {isDetecting ? 'Detecting...' : 'Detect Chapters'}
                <ChevronRightIcon size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Chapter Detection */}
        {step === 'chapters' && (
          <div className={styles.content}>
            <div className={styles.titleSection}>
              <input
                type="text"
                value={novelTitle}
                onChange={e => setNovelTitle(e.target.value)}
                className={styles.novelTitleInput}
                placeholder="Novel Title"
              />
              <p>{totalWordCount.toLocaleString()} words • {chapters.length} chapters detected</p>
            </div>

            <div className={styles.chapterList}>
              {acts.length > 0 ? (
                acts.map(act => (
                  <div key={act.number} className={styles.actGroup}>
                    <h3 className={styles.actTitle}>{act.title}</h3>
                    {chapters
                      .filter(ch => ch.index >= act.startChapter && ch.index <= act.endChapter)
                      .map(chapter => (
                        <label key={chapter.index} className={styles.chapterItem}>
                          <input
                            type="checkbox"
                            checked={chapter.selected}
                            onChange={() => setChapters(chs =>
                              chs.map(ch => ch.index === chapter.index ? { ...ch, selected: !ch.selected } : ch)
                            )}
                          />
                          <div className={styles.chapterInfo}>
                            <span className={styles.chapterTitle}>{chapter.title}</span>
                            <span className={styles.chapterMeta}>
                              {chapter.wordCount.toLocaleString()} words
                            </span>
                          </div>
                        </label>
                      ))}
                  </div>
                ))
              ) : (
                chapters.map(chapter => (
                  <label key={chapter.index} className={styles.chapterItem}>
                    <input
                      type="checkbox"
                      checked={chapter.selected}
                      onChange={() => setChapters(chs =>
                        chs.map(ch => ch.index === chapter.index ? { ...ch, selected: !ch.selected } : ch)
                      )}
                    />
                    <div className={styles.chapterInfo}>
                      <span className={styles.chapterTitle}>{chapter.title}</span>
                      <span className={styles.chapterMeta}>
                        {chapter.wordCount.toLocaleString()} words
                      </span>
                      <span className={styles.chapterPreview}>{chapter.preview}</span>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className={styles.selectionSummary}>
              {chapters.filter(ch => ch.selected).length} of {chapters.length} chapters selected
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button className={styles.backBtn} onClick={() => setStep('upload')}>
                <ChevronLeftIcon size={18} />
                Back
              </button>
              <button
                className={styles.primaryBtn}
                onClick={analyzeChapters}
                disabled={chapters.filter(ch => ch.selected).length === 0}
              >
                Analyze Selected Chapters
                <SparklesIcon size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Analyzing */}
        {step === 'analyzing' && (
          <div className={styles.content}>
            <div className={styles.analyzingContainer}>
              <div className={styles.analyzingAnimation}>
                <div className={styles.pulseRing} />
                <div className={styles.pulseRing} style={{ animationDelay: '0.5s' }} />
                <SparklesIcon size={48} color="#6366f1" />
              </div>

              <h2>Analyzing Your Novel</h2>
              <p className={styles.analyzingStatus}>
                Processing chapter {analyzingIndex + 1} of {chapters.filter(ch => ch.selected).length}
              </p>

              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>

              <div className={styles.extractionStatus}>
                <div className={styles.statusItem}>
                  <UsersIcon size={20} />
                  <span>{allCharacters.length} characters</span>
                </div>
                <div className={styles.statusItem}>
                  <LocationIcon size={20} />
                  <span>{allLocations.length} locations</span>
                </div>
                <div className={styles.statusItem}>
                  <FilmIcon size={20} />
                  <span>{allScenes.length} scenes</span>
                </div>
                <div className={styles.statusItem}>
                  <BookIcon size={20} />
                  <span>{allLore.length} lore entries</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 'review' && (
          <div className={styles.content}>
            <div className={styles.titleSection}>
              <h2>Review Extracted Content</h2>
              <p>Select what to include in your cinematic project</p>
            </div>

            <div className={styles.reviewTabs}>
              <button
                className={`${styles.reviewTab} ${reviewTab === 'characters' ? styles.active : ''}`}
                onClick={() => setReviewTab('characters')}
              >
                <UsersIcon size={18} />
                Characters ({allCharacters.filter(c => c.selected).length}/{allCharacters.length})
              </button>
              <button
                className={`${styles.reviewTab} ${reviewTab === 'locations' ? styles.active : ''}`}
                onClick={() => setReviewTab('locations')}
              >
                <LocationIcon size={18} />
                Locations ({allLocations.filter(l => l.selected).length}/{allLocations.length})
              </button>
              <button
                className={`${styles.reviewTab} ${reviewTab === 'scenes' ? styles.active : ''}`}
                onClick={() => setReviewTab('scenes')}
              >
                <FilmIcon size={18} />
                Scenes ({allScenes.filter(s => s.selected).length}/{allScenes.length})
              </button>
              <button
                className={`${styles.reviewTab} ${reviewTab === 'lore' ? styles.active : ''}`}
                onClick={() => setReviewTab('lore')}
              >
                <BookIcon size={18} />
                Lore ({allLore.filter(l => l.selected).length}/{allLore.length})
              </button>
            </div>

            <div className={styles.selectionActions}>
              <button onClick={() => selectAll(reviewTab, true)}>Select All</button>
              <button onClick={() => selectAll(reviewTab, false)}>Deselect All</button>
            </div>

            <div className={styles.reviewContent}>
              {reviewTab === 'characters' && (
                <div className={styles.itemGrid}>
                  {allCharacters.map(char => (
                    <label key={char.id} className={`${styles.itemCard} ${char.selected ? styles.selected : ''}`}>
                      <input
                        type="checkbox"
                        checked={char.selected}
                        onChange={() => toggleCharacter(char.id)}
                      />
                      <div className={styles.itemCardContent}>
                        <h4>{char.name}</h4>
                        <span className={styles.itemRole}>{char.role}</span>
                        <p>{char.description.substring(0, 120)}...</p>
                        <div className={styles.itemMeta}>
                          <span>Appears in {char.appearances.length} chapters</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {reviewTab === 'locations' && (
                <div className={styles.itemGrid}>
                  {allLocations.map(loc => (
                    <label key={loc.id} className={`${styles.itemCard} ${loc.selected ? styles.selected : ''}`}>
                      <input
                        type="checkbox"
                        checked={loc.selected}
                        onChange={() => toggleLocation(loc.id)}
                      />
                      <div className={styles.itemCardContent}>
                        <h4>{loc.name}</h4>
                        <p>{loc.description.substring(0, 120)}...</p>
                        <div className={styles.itemMeta}>
                          <span>Appears in {loc.appearances.length} chapters</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {reviewTab === 'scenes' && (
                <div className={styles.sceneList}>
                  {allScenes.map(scene => (
                    <label key={scene.id} className={`${styles.sceneItem} ${scene.selected ? styles.selected : ''}`}>
                      <input
                        type="checkbox"
                        checked={scene.selected}
                        onChange={() => toggleScene(scene.id)}
                      />
                      <div className={styles.sceneContent}>
                        <div className={styles.sceneHeader}>
                          <h4>{scene.title}</h4>
                          <span className={styles.sceneType}>{scene.sceneType}</span>
                        </div>
                        <p>{scene.description}</p>
                        <div className={styles.sceneMeta}>
                          <span>{scene.emotionalBeat}</span>
                          <span>Ch. {scene.chapterIndex + 1}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {reviewTab === 'lore' && (
                <div className={styles.itemGrid}>
                  {allLore.map(item => (
                    <label key={item.id} className={`${styles.itemCard} ${item.selected ? styles.selected : ''}`}>
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleLore(item.id)}
                      />
                      <div className={styles.itemCardContent}>
                        <h4>{item.name}</h4>
                        <span className={styles.itemRole}>{item.type}</span>
                        <p>{item.description.substring(0, 120)}...</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <button className={styles.backBtn} onClick={() => setStep('chapters')}>
                <ChevronLeftIcon size={18} />
                Back
              </button>
              <button
                className={styles.primaryBtn}
                onClick={() => setStep('configure')}
                disabled={allScenes.filter(s => s.selected).length === 0}
              >
                Configure Project
                <ChevronRightIcon size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Configure */}
        {step === 'configure' && (
          <div className={styles.content}>
            <div className={styles.titleSection}>
              <h2>Configure Your Project</h2>
              <p>Set visual style and generation options</p>
            </div>

            <div className={styles.configSection}>
              <h3>Visual Style</h3>
              <div className={styles.optionGrid}>
                <div className={styles.optionGroup}>
                  <label>Genre / Aesthetic</label>
                  <select value={genre} onChange={e => setGenre(e.target.value)}>
                    {GENRES.map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.optionGroup}>
                  <label>Visual Style</label>
                  <select value={visualStyle} onChange={e => setVisualStyle(e.target.value)}>
                    {VISUAL_STYLES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.configSection}>
              <h3>Image Generation</h3>
              <div className={styles.generationOptions}>
                <label className={styles.generationOption}>
                  <input
                    type="checkbox"
                    checked={generateSceneImages}
                    onChange={e => setGenerateSceneImages(e.target.checked)}
                  />
                  <div>
                    <span>Scene Images</span>
                    <small>{selectedSceneCount} scenes × 10 credits = {selectedSceneCount * 10} credits</small>
                  </div>
                </label>
                <label className={styles.generationOption}>
                  <input
                    type="checkbox"
                    checked={generateCharacterPortraits}
                    onChange={e => setGenerateCharacterPortraits(e.target.checked)}
                  />
                  <div>
                    <span>Character Portraits</span>
                    <small>{selectedCharacterCount} characters × 10 credits = {selectedCharacterCount * 10} credits</small>
                  </div>
                </label>
                <label className={styles.generationOption}>
                  <input
                    type="checkbox"
                    checked={generateLocationArt}
                    onChange={e => setGenerateLocationArt(e.target.checked)}
                  />
                  <div>
                    <span>Location Art</span>
                    <small>{selectedLocationCount} locations × 10 credits = {selectedLocationCount * 10} credits</small>
                  </div>
                </label>
              </div>
            </div>

            <div className={styles.creditsSummary}>
              <div className={styles.creditsRow}>
                <span>Estimated Credits</span>
                <strong>{creditsEstimate} credits</strong>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.backBtn} onClick={() => setStep('review')}>
                <ChevronLeftIcon size={18} />
                Back
              </button>
              <button
                className={styles.primaryBtn}
                onClick={handleComplete}
              >
                Create Project
                <SparklesIcon size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Generating */}
        {step === 'generating' && (
          <div className={styles.content}>
            <div className={styles.analyzingContainer}>
              <div className={styles.analyzingAnimation}>
                <div className={styles.pulseRing} />
                <div className={styles.pulseRing} style={{ animationDelay: '0.5s' }} />
                <FilmIcon size={48} color="#6366f1" />
              </div>

              <h2>Creating Your Cinematic Project</h2>
              <p className={styles.analyzingStatus}>
                Building your world from {novelTitle}...
              </p>

              <div className={styles.generatingSummary}>
                <div>{allCharacters.filter(c => c.selected).length} characters</div>
                <div>{allLocations.filter(l => l.selected).length} locations</div>
                <div>{allScenes.filter(s => s.selected).length} scenes</div>
                <div>{allLore.filter(l => l.selected).length} lore entries</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

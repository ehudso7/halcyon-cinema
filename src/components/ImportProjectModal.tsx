import { useState, useEffect, FormEvent, useCallback } from 'react';
import {
  DocumentIcon,
  UsersIcon,
  GlobeIcon,
  FilmIcon,
  PaletteIcon,
  SparklesIcon,
  CheckCircleIcon,
  BookIcon,
  LocationIcon,
  CalendarIcon,
  CogIcon,
  ZapIcon,
  UploadIcon,
} from './Icons';
import styles from './ImportProjectModal.module.css';

// Types
export interface QuickCreateData {
  prompt: string;
  genre: string;
  mood: string;
  sceneCount: number;
}

export interface ExtractedCharacter {
  name: string;
  description: string;
  traits: string[];
  role?: string;
  selected: boolean;
}

export interface ExtractedLocation {
  name: string;
  description: string;
  type: 'location';
  selected: boolean;
}

export interface ExtractedLore {
  name: string;
  description: string;
  type: 'event' | 'system' | 'object' | 'concept';
  selected: boolean;
}

export interface ExtractedScene {
  title: string;
  description: string;
  visualPrompt: string;
  selected: boolean;
}

export interface DocumentAnalysis {
  summary: string;
  characters: ExtractedCharacter[];
  locations: ExtractedLocation[];
  lore: ExtractedLore[];
  scenes: ExtractedScene[];
  detectedGenre?: string;
  detectedTone?: string;
}

interface ImportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuickCreate: (data: QuickCreateData) => Promise<void>;
  onImportCreate: (data: ImportCreateData) => Promise<void>;
  onBlankCreate: (name: string, description: string) => Promise<void>;
  isGenerating?: boolean;
  generationStep?: string;
}

export interface ImportCreateData {
  projectName: string;
  projectDescription: string;
  sourceContent: string;
  characters: ExtractedCharacter[];
  lore: (ExtractedLore | ExtractedLocation)[];
  scenes: ExtractedScene[];
  genre: string;
  mood: string;
  generateImages: boolean;
}

type TabId = 'quick' | 'import' | 'blank';

const GENRES = [
  { value: 'cinematic-realism', label: 'Cinematic Realism' },
  { value: 'film-noir', label: 'Film Noir' },
  { value: 'sci-fi', label: 'Science Fiction' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'anime', label: 'Anime' },
  { value: 'horror', label: 'Horror' },
  { value: 'western', label: 'Western' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'steampunk', label: 'Steampunk' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'a24-indie', label: 'A24 Indie' },
  { value: 'thriller', label: 'Thriller' },
];

const MOODS = [
  { value: 'epic', label: 'Epic', color: '#FFD700' },
  { value: 'mysterious', label: 'Mysterious', color: '#8B5CF6' },
  { value: 'romantic', label: 'Romantic', color: '#EC4899' },
  { value: 'tense', label: 'Tense', color: '#EF4444' },
  { value: 'peaceful', label: 'Peaceful', color: '#10B981' },
  { value: 'melancholic', label: 'Melancholic', color: '#6B7280' },
  { value: 'joyful', label: 'Joyful', color: '#F59E0B' },
  { value: 'dark', label: 'Dark', color: '#1F2937' },
  { value: 'adventurous', label: 'Adventurous', color: '#3B82F6' },
  { value: 'nostalgic', label: 'Nostalgic', color: '#D97706' },
  { value: 'dreamy', label: 'Dreamy', color: '#A78BFA' },
  { value: 'gritty', label: 'Gritty', color: '#78716C' },
];

const EXAMPLE_PROMPTS = [
  "A detective investigates a missing person case in a rain-soaked city where nothing is what it seems",
  "An astronaut discovers an ancient alien artifact on Mars that begins to change her",
  "A young wizard begins their journey at a magical academy hiding dark secrets",
  "A samurai seeks redemption after years of wandering, haunted by past failures",
];

const GENERATION_STEPS = [
  { id: 'story', label: 'Weaving narrative threads...', IconComponent: DocumentIcon },
  { id: 'characters', label: 'Breathing life into characters...', IconComponent: UsersIcon },
  { id: 'world', label: 'Building your world...', IconComponent: GlobeIcon },
  { id: 'scenes', label: 'Crafting cinematic scenes...', IconComponent: FilmIcon },
  { id: 'style', label: 'Defining visual language...', IconComponent: PaletteIcon },
  { id: 'polish', label: 'Adding final polish...', IconComponent: SparklesIcon },
];

const LORE_TYPE_ICONS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  location: LocationIcon,
  event: CalendarIcon,
  system: CogIcon,
  object: BookIcon,
  concept: SparklesIcon,
};

export default function ImportProjectModal({
  isOpen,
  onClose,
  onQuickCreate,
  onImportCreate,
  onBlankCreate,
  isGenerating = false,
  generationStep,
}: ImportProjectModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('quick');

  // Quick Create state
  const [quickPrompt, setQuickPrompt] = useState('');
  const [quickGenre, setQuickGenre] = useState('cinematic-realism');
  const [quickMood, setQuickMood] = useState('epic');
  const [quickSceneCount, setQuickSceneCount] = useState(5);

  // Import state
  const [importStep, setImportStep] = useState<'input' | 'analyzing' | 'review'>('input');
  const [importContent, setImportContent] = useState('');
  const [importProjectName, setImportProjectName] = useState('');
  const [importGenre, setImportGenre] = useState('sci-fi');
  const [importMood, setImportMood] = useState('epic');
  const [importGenerateImages, setImportGenerateImages] = useState(true);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Blank state
  const [blankName, setBlankName] = useState('');
  const [blankDescription, setBlankDescription] = useState('');

  // Shared state
  const [error, setError] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Animate through generation steps
  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setCurrentStepIndex((prev) => (prev + 1) % GENERATION_STEPS.length);
      }, 2500);
      return () => clearInterval(interval);
    } else {
      setCurrentStepIndex(0);
    }
  }, [isGenerating]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('quick');
      setQuickPrompt('');
      setQuickGenre('cinematic-realism');
      setQuickMood('epic');
      setQuickSceneCount(5);
      setImportStep('input');
      setImportContent('');
      setImportProjectName('');
      setAnalysis(null);
      setBlankName('');
      setBlankDescription('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (!isGenerating && !isAnalyzing) {
      onClose();
    }
  };

  // Quick Create handlers
  const handleQuickSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedPrompt = quickPrompt.trim();
    if (!trimmedPrompt) {
      setError('Please describe your story idea');
      return;
    }

    if (trimmedPrompt.length < 20) {
      setError('Please provide a more detailed description (at least 20 characters)');
      return;
    }

    await onQuickCreate({
      prompt: trimmedPrompt,
      genre: quickGenre,
      mood: quickMood,
      sceneCount: quickSceneCount,
    });
  };

  // Import handlers
  const handleAnalyzeContent = async () => {
    if (!importContent.trim()) {
      setError('Please paste or enter your story content');
      return;
    }

    if (importContent.trim().length < 100) {
      setError('Please provide more content (at least 100 characters)');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setImportStep('analyzing');

    try {
      const response = await fetch('/api/import/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: importContent.trim(),
          extractAll: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to analyze content');
      }

      const result = await response.json();

      // Convert to our format with selected flags
      const analysisData: DocumentAnalysis = {
        summary: result.summary || '',
        characters: (result.characters || []).map((c: { name: string; description: string; traits?: string[]; role?: string }) => ({
          ...c,
          traits: c.traits || [],
          selected: true,
        })),
        locations: (result.locations || []).map((l: { name: string; description: string }) => ({
          ...l,
          type: 'location' as const,
          selected: true,
        })),
        lore: (result.lore || []).map((l: { name: string; description: string; type?: string }) => ({
          ...l,
          type: l.type || 'concept',
          selected: true,
        })),
        scenes: (result.scenes || []).map((s: { title: string; description: string; visualPrompt?: string }) => ({
          ...s,
          visualPrompt: s.visualPrompt || s.description,
          selected: true,
        })),
        detectedGenre: result.detectedGenre,
        detectedTone: result.detectedTone,
      };

      setAnalysis(analysisData);

      // Auto-set genre and mood if detected
      if (result.detectedGenre) {
        const matchedGenre = GENRES.find(g =>
          g.value.toLowerCase().includes(result.detectedGenre.toLowerCase()) ||
          result.detectedGenre.toLowerCase().includes(g.value.replace('-', ' '))
        );
        if (matchedGenre) setImportGenre(matchedGenre.value);
      }

      if (result.detectedTone) {
        const matchedMood = MOODS.find(m =>
          m.value.toLowerCase().includes(result.detectedTone.toLowerCase()) ||
          result.detectedTone.toLowerCase().includes(m.value)
        );
        if (matchedMood) setImportMood(matchedMood.value);
      }

      // Generate project name from first scene or summary
      if (!importProjectName && result.scenes?.[0]?.title) {
        setImportProjectName(result.scenes[0].title.split(':')[0] || 'Imported Project');
      }

      setImportStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze content');
      setImportStep('input');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!analysis) return;

    if (!importProjectName.trim()) {
      setError('Please enter a project name');
      return;
    }

    const selectedCharacters = analysis.characters.filter(c => c.selected);
    const selectedLore = [
      ...analysis.locations.filter(l => l.selected),
      ...analysis.lore.filter(l => l.selected),
    ];
    const selectedScenes = analysis.scenes.filter(s => s.selected);

    if (selectedScenes.length === 0) {
      setError('Please select at least one scene');
      return;
    }

    await onImportCreate({
      projectName: importProjectName.trim(),
      projectDescription: analysis.summary,
      sourceContent: importContent,
      characters: selectedCharacters,
      lore: selectedLore,
      scenes: selectedScenes,
      genre: importGenre,
      mood: importMood,
      generateImages: importGenerateImages,
    });
  };

  const toggleCharacter = (index: number) => {
    if (!analysis) return;
    const updated = [...analysis.characters];
    updated[index] = { ...updated[index], selected: !updated[index].selected };
    setAnalysis({ ...analysis, characters: updated });
  };

  const toggleLocation = (index: number) => {
    if (!analysis) return;
    const updated = [...analysis.locations];
    updated[index] = { ...updated[index], selected: !updated[index].selected };
    setAnalysis({ ...analysis, locations: updated });
  };

  const toggleLore = (index: number) => {
    if (!analysis) return;
    const updated = [...analysis.lore];
    updated[index] = { ...updated[index], selected: !updated[index].selected };
    setAnalysis({ ...analysis, lore: updated });
  };

  const toggleScene = (index: number) => {
    if (!analysis) return;
    const updated = [...analysis.scenes];
    updated[index] = { ...updated[index], selected: !updated[index].selected };
    setAnalysis({ ...analysis, scenes: updated });
  };

  const selectAllInCategory = (category: 'characters' | 'locations' | 'lore' | 'scenes', selectAll: boolean) => {
    if (!analysis) return;
    if (category === 'characters') {
      setAnalysis({
        ...analysis,
        characters: analysis.characters.map(c => ({ ...c, selected: selectAll })),
      });
    } else if (category === 'locations') {
      setAnalysis({
        ...analysis,
        locations: analysis.locations.map(l => ({ ...l, selected: selectAll })),
      });
    } else if (category === 'lore') {
      setAnalysis({
        ...analysis,
        lore: analysis.lore.map(l => ({ ...l, selected: selectAll })),
      });
    } else if (category === 'scenes') {
      setAnalysis({
        ...analysis,
        scenes: analysis.scenes.map(s => ({ ...s, selected: selectAll })),
      });
    }
  };

  // Blank handlers
  const handleBlankSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!blankName.trim()) {
      setError('Please enter a project name');
      return;
    }

    await onBlankCreate(blankName.trim(), blankDescription.trim());
  };

  const selectedGenre = GENRES.find((g) => g.value === quickGenre);
  const selectedMood = MOODS.find((m) => m.value === quickMood);

  // Generation in progress view
  if (isGenerating) {
    const currentStep = GENERATION_STEPS[currentStepIndex];
    return (
      <div className={styles.overlay}>
        <div className={`${styles.modal} ${styles.generatingModal}`}>
          <div className={styles.generatingContainer}>
            <div className={styles.generatingAnimation}>
              <div className={styles.pulseRing} />
              <div className={styles.pulseRing} style={{ animationDelay: '0.5s' }} />
              <div className={styles.pulseRing} style={{ animationDelay: '1s' }} />
              <div className={styles.generatingIcon}>
                <span className={styles.stepIcon}><currentStep.IconComponent size={32} color="#6366f1" /></span>
              </div>
            </div>

            <h2 className={styles.generatingTitle}>
              {activeTab === 'import' ? 'Creating Your Project' : 'Creating Your Cinematic World'}
            </h2>
            <p className={styles.generatingStep}>{generationStep || currentStep.label}</p>

            <div className={styles.progressSteps}>
              {GENERATION_STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={`${styles.progressStep} ${
                    index < currentStepIndex ? styles.completed :
                    index === currentStepIndex ? styles.active : ''
                  }`}
                >
                  <span className={styles.progressDot} />
                </div>
              ))}
            </div>

            {activeTab === 'quick' && quickPrompt && (
              <div className={styles.generatingPreview}>
                <p className={styles.previewPrompt}>&ldquo;{quickPrompt.slice(0, 100)}{quickPrompt.length > 100 ? '...' : ''}&rdquo;</p>
                <div className={styles.previewTags}>
                  <span className={styles.previewTag}>{selectedGenre?.label}</span>
                  <span className={styles.previewTag} style={{ borderColor: selectedMood?.color }}>{selectedMood?.label}</span>
                  <span className={styles.previewTag}>{quickSceneCount} Scenes</span>
                </div>
              </div>
            )}

            {activeTab === 'import' && importProjectName && (
              <div className={styles.generatingPreview}>
                <p className={styles.previewPrompt}>{importProjectName}</p>
                <div className={styles.previewTags}>
                  <span className={styles.previewTag}>{analysis?.characters.filter(c => c.selected).length || 0} Characters</span>
                  <span className={styles.previewTag}>{analysis?.scenes.filter(s => s.selected).length || 0} Scenes</span>
                  <span className={styles.previewTag}>{(analysis?.locations.filter(l => l.selected).length || 0) + (analysis?.lore.filter(l => l.selected).length || 0)} Lore</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Analyzing view
  if (isAnalyzing) {
    return (
      <div className={styles.overlay}>
        <div className={`${styles.modal} ${styles.generatingModal}`}>
          <div className={styles.generatingContainer}>
            <div className={styles.generatingAnimation}>
              <div className={styles.pulseRing} />
              <div className={styles.pulseRing} style={{ animationDelay: '0.5s' }} />
              <div className={styles.pulseRing} style={{ animationDelay: '1s' }} />
              <div className={styles.generatingIcon}>
                <span className={styles.stepIcon}><BookIcon size={32} color="#6366f1" /></span>
              </div>
            </div>

            <h2 className={styles.generatingTitle}>Analyzing Your Story</h2>
            <p className={styles.generatingStep}>Extracting characters, locations, lore, and scenes...</p>

            <div className={styles.analyzeProgress}>
              <div className={styles.analyzeItem}>
                <UsersIcon size={20} />
                <span>Finding characters...</span>
              </div>
              <div className={styles.analyzeItem}>
                <LocationIcon size={20} />
                <span>Mapping locations...</span>
              </div>
              <div className={styles.analyzeItem}>
                <BookIcon size={20} />
                <span>Discovering world lore...</span>
              </div>
              <div className={styles.analyzeItem}>
                <FilmIcon size={20} />
                <span>Identifying scenes...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={handleClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Tab Navigation */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'quick' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('quick')}
          >
            <ZapIcon size={18} />
            <span>Quick Create</span>
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'import' ? styles.activeTab : ''}`}
            onClick={() => { setActiveTab('import'); setImportStep('input'); }}
          >
            <UploadIcon size={18} />
            <span>Import Existing</span>
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'blank' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('blank')}
          >
            <DocumentIcon size={18} />
            <span>Start Blank</span>
          </button>
        </div>

        {/* Quick Create Tab */}
        {activeTab === 'quick' && (
          <div className={styles.tabContent}>
            <div className={styles.header}>
              <div className={styles.headerIcon}>
                <ZapIcon size={28} color="white" />
              </div>
              <div>
                <h2 className={styles.title}>Quick Create</h2>
                <p className={styles.subtitle}>
                  One prompt. Complete cinematic project. Studio-ready quality.
                </p>
              </div>
            </div>

            <form onSubmit={handleQuickSubmit}>
              <div className={styles.field}>
                <label htmlFor="storyPrompt" className={styles.label}>
                  Your Story Seed <span className={styles.required}>*</span>
                </label>
                <textarea
                  id="storyPrompt"
                  value={quickPrompt}
                  onChange={(e) => setQuickPrompt(e.target.value)}
                  placeholder="Describe your story in a few sentences... The AI will expand this into a complete cinematic project."
                  className={styles.textarea}
                  rows={4}
                  autoFocus
                />
                <div className={styles.examples}>
                  <span className={styles.examplesLabel}>Try one:</span>
                  <div className={styles.exampleChips}>
                    {EXAMPLE_PROMPTS.map((example, i) => (
                      <button
                        key={i}
                        type="button"
                        className={styles.exampleChip}
                        onClick={() => setQuickPrompt(example)}
                      >
                        {example.length > 50 ? example.slice(0, 50) + '...' : example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>Genre</label>
                  <div className={styles.genreGrid}>
                    {GENRES.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        className={`${styles.genreOption} ${quickGenre === g.value ? styles.selected : ''}`}
                        onClick={() => setQuickGenre(g.value)}
                      >
                        <span className={styles.genreLabel}>{g.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>Mood</label>
                  <div className={styles.moodGrid}>
                    {MOODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        className={`${styles.moodOption} ${quickMood === m.value ? styles.selected : ''}`}
                        onClick={() => setQuickMood(m.value)}
                        style={{ '--mood-color': m.color } as React.CSSProperties}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="sceneCount" className={styles.label}>
                  Scenes: <strong>{quickSceneCount}</strong>
                </label>
                <input
                  id="sceneCount"
                  type="range"
                  min="3"
                  max="10"
                  value={quickSceneCount}
                  onChange={(e) => setQuickSceneCount(parseInt(e.target.value))}
                  className={styles.slider}
                />
                <div className={styles.sliderLabels}>
                  <span>3 (Quick)</span>
                  <span>10 (Epic)</span>
                </div>
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <div className={styles.deliverables}>
                <h4 className={styles.deliverablesTitle}>Your Cinematic Package Includes:</h4>
                <div className={styles.deliverablesList}>
                  <div className={styles.deliverable}>
                    <span className={styles.deliverableIcon}><DocumentIcon size={20} color="#6366f1" /></span>
                    <div>
                      <strong>Logline & Tagline</strong>
                      <span>Marketable pitch materials</span>
                    </div>
                  </div>
                  <div className={styles.deliverable}>
                    <span className={styles.deliverableIcon}><FilmIcon size={20} color="#6366f1" /></span>
                    <div>
                      <strong>{quickSceneCount} Screenplay Scenes</strong>
                      <span>With sluglines & action</span>
                    </div>
                  </div>
                  <div className={styles.deliverable}>
                    <span className={styles.deliverableIcon}><UsersIcon size={20} color="#6366f1" /></span>
                    <div>
                      <strong>Character Profiles</strong>
                      <span>Arcs, traits & visuals</span>
                    </div>
                  </div>
                  <div className={styles.deliverable}>
                    <span className={styles.deliverableIcon}><GlobeIcon size={20} color="#6366f1" /></span>
                    <div>
                      <strong>World Lore</strong>
                      <span>Locations, events & systems</span>
                    </div>
                  </div>
                  <div className={styles.deliverable}>
                    <span className={styles.deliverableIcon}><PaletteIcon size={20} color="#6366f1" /></span>
                    <div>
                      <strong>Visual Style Guide</strong>
                      <span>Colors, lighting & motifs</span>
                    </div>
                  </div>
                  <div className={styles.deliverable}>
                    <span className={styles.deliverableIcon}><CheckCircleIcon size={20} color="#10b981" /></span>
                    <div>
                      <strong>Quality Metrics</strong>
                      <span>Professional grade scoring</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.actions}>
                <button type="button" onClick={handleClose} className={`btn btn-secondary ${styles.cancelBtn}`}>
                  Cancel
                </button>
                <button type="submit" className={`btn btn-primary ${styles.generateBtn}`} disabled={!quickPrompt.trim()}>
                  <ZapIcon size={18} />
                  Generate Cinematic Project
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Import Tab - Input Step */}
        {activeTab === 'import' && importStep === 'input' && (
          <div className={styles.tabContent}>
            <div className={styles.header}>
              <div className={styles.headerIcon}>
                <UploadIcon size={28} color="white" />
              </div>
              <div>
                <h2 className={styles.title}>Import Existing Story</h2>
                <p className={styles.subtitle}>
                  Paste your script, story, or outline. AI will extract characters, locations, and scenes.
                </p>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="importContent" className={styles.label}>
                Your Story Content <span className={styles.required}>*</span>
              </label>
              <textarea
                id="importContent"
                value={importContent}
                onChange={(e) => setImportContent(e.target.value)}
                placeholder="Paste your story, script, novel excerpt, or outline here...

The AI will analyze your content and extract:
• Characters with descriptions and traits
• Locations and world-building elements
• Key scenes for visualization
• Detected genre and tone"
                className={styles.textareaLarge}
                rows={12}
                autoFocus
              />
              <div className={styles.charCount}>
                {importContent.length.toLocaleString()} characters
                {importContent.length > 50000 && (
                  <span className={styles.charWarning}> (content will be truncated at 50,000)</span>
                )}
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.importInfo}>
              <h4>What happens next?</h4>
              <div className={styles.importSteps}>
                <div className={styles.importStepItem}>
                  <span className={styles.importStepNumber}>1</span>
                  <div>
                    <strong>AI Analysis</strong>
                    <span>We&apos;ll extract characters, locations, lore, and scenes</span>
                  </div>
                </div>
                <div className={styles.importStepItem}>
                  <span className={styles.importStepNumber}>2</span>
                  <div>
                    <strong>Review & Select</strong>
                    <span>Choose which elements to include in your project</span>
                  </div>
                </div>
                <div className={styles.importStepItem}>
                  <span className={styles.importStepNumber}>3</span>
                  <div>
                    <strong>Create Project</strong>
                    <span>Generate visuals and organize your cinematic project</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              <button type="button" onClick={handleClose} className={`btn btn-secondary ${styles.cancelBtn}`}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAnalyzeContent}
                className={`btn btn-primary ${styles.generateBtn}`}
                disabled={!importContent.trim() || importContent.trim().length < 100}
              >
                <SparklesIcon size={18} />
                Analyze Content
              </button>
            </div>
          </div>
        )}

        {/* Import Tab - Review Step */}
        {activeTab === 'import' && importStep === 'review' && analysis && (
          <div className={styles.tabContent}>
            <div className={styles.header}>
              <div className={styles.headerIconSuccess}>
                <CheckCircleIcon size={28} color="white" />
              </div>
              <div>
                <h2 className={styles.title}>Analysis Complete</h2>
                <p className={styles.subtitle}>
                  Review and select the elements to include in your project.
                </p>
              </div>
            </div>

            {/* Project Name */}
            <div className={styles.field}>
              <label htmlFor="importProjectName" className={styles.label}>
                Project Name <span className={styles.required}>*</span>
              </label>
              <input
                id="importProjectName"
                type="text"
                value={importProjectName}
                onChange={(e) => setImportProjectName(e.target.value)}
                placeholder="Enter a name for your project"
                className={styles.input}
              />
            </div>

            {/* Summary */}
            {analysis.summary && (
              <div className={styles.summaryBox}>
                <h4>Summary</h4>
                <p>{analysis.summary}</p>
              </div>
            )}

            {/* Extracted Content Sections */}
            <div className={styles.extractedSections}>
              {/* Characters */}
              {analysis.characters.length > 0 && (
                <div className={styles.extractedSection}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                      <UsersIcon size={20} />
                      <h4>Characters ({analysis.characters.filter(c => c.selected).length}/{analysis.characters.length})</h4>
                    </div>
                    <div className={styles.sectionActions}>
                      <button
                        type="button"
                        className={styles.selectAllBtn}
                        onClick={() => selectAllInCategory('characters', true)}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className={styles.selectAllBtn}
                        onClick={() => selectAllInCategory('characters', false)}
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className={styles.extractedList}>
                    {analysis.characters.map((char, index) => (
                      <label key={index} className={`${styles.extractedItem} ${char.selected ? styles.itemSelected : ''}`}>
                        <input
                          type="checkbox"
                          checked={char.selected}
                          onChange={() => toggleCharacter(index)}
                          className={styles.checkbox}
                        />
                        <div className={styles.itemContent}>
                          <strong>{char.name}</strong>
                          <span>{char.description.slice(0, 100)}{char.description.length > 100 ? '...' : ''}</span>
                          {char.traits.length > 0 && (
                            <div className={styles.itemTags}>
                              {char.traits.slice(0, 3).map((trait, i) => (
                                <span key={i} className={styles.itemTag}>{trait}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Locations */}
              {analysis.locations.length > 0 && (
                <div className={styles.extractedSection}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                      <LocationIcon size={20} />
                      <h4>Locations ({analysis.locations.filter(l => l.selected).length}/{analysis.locations.length})</h4>
                    </div>
                    <div className={styles.sectionActions}>
                      <button type="button" className={styles.selectAllBtn} onClick={() => selectAllInCategory('locations', true)}>
                        Select All
                      </button>
                      <button type="button" className={styles.selectAllBtn} onClick={() => selectAllInCategory('locations', false)}>
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className={styles.extractedList}>
                    {analysis.locations.map((loc, index) => (
                      <label key={index} className={`${styles.extractedItem} ${loc.selected ? styles.itemSelected : ''}`}>
                        <input
                          type="checkbox"
                          checked={loc.selected}
                          onChange={() => toggleLocation(index)}
                          className={styles.checkbox}
                        />
                        <div className={styles.itemContent}>
                          <strong>{loc.name}</strong>
                          <span>{loc.description.slice(0, 100)}{loc.description.length > 100 ? '...' : ''}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* World Lore */}
              {analysis.lore.length > 0 && (
                <div className={styles.extractedSection}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                      <BookIcon size={20} />
                      <h4>World Lore ({analysis.lore.filter(l => l.selected).length}/{analysis.lore.length})</h4>
                    </div>
                    <div className={styles.sectionActions}>
                      <button type="button" className={styles.selectAllBtn} onClick={() => selectAllInCategory('lore', true)}>
                        Select All
                      </button>
                      <button type="button" className={styles.selectAllBtn} onClick={() => selectAllInCategory('lore', false)}>
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className={styles.extractedList}>
                    {analysis.lore.map((item, index) => {
                      const LoreIcon = LORE_TYPE_ICONS[item.type] || BookIcon;
                      return (
                        <label key={index} className={`${styles.extractedItem} ${item.selected ? styles.itemSelected : ''}`}>
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => toggleLore(index)}
                            className={styles.checkbox}
                          />
                          <div className={styles.itemContent}>
                            <div className={styles.itemHeader}>
                              <LoreIcon size={16} />
                              <strong>{item.name}</strong>
                              <span className={styles.itemType}>{item.type}</span>
                            </div>
                            <span>{item.description.slice(0, 100)}{item.description.length > 100 ? '...' : ''}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Scenes */}
              {analysis.scenes.length > 0 && (
                <div className={styles.extractedSection}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                      <FilmIcon size={20} />
                      <h4>Scenes ({analysis.scenes.filter(s => s.selected).length}/{analysis.scenes.length})</h4>
                    </div>
                    <div className={styles.sectionActions}>
                      <button type="button" className={styles.selectAllBtn} onClick={() => selectAllInCategory('scenes', true)}>
                        Select All
                      </button>
                      <button type="button" className={styles.selectAllBtn} onClick={() => selectAllInCategory('scenes', false)}>
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className={styles.extractedList}>
                    {analysis.scenes.map((scene, index) => (
                      <label key={index} className={`${styles.extractedItem} ${scene.selected ? styles.itemSelected : ''}`}>
                        <input
                          type="checkbox"
                          checked={scene.selected}
                          onChange={() => toggleScene(index)}
                          className={styles.checkbox}
                        />
                        <div className={styles.itemContent}>
                          <strong>{scene.title}</strong>
                          <span>{scene.description.slice(0, 150)}{scene.description.length > 150 ? '...' : ''}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Visual Style Options */}
            <div className={styles.styleOptions}>
              <div className={styles.styleRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Genre</label>
                  <select
                    value={importGenre}
                    onChange={(e) => setImportGenre(e.target.value)}
                    className={styles.select}
                  >
                    {GENRES.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Mood</label>
                  <select
                    value={importMood}
                    onChange={(e) => setImportMood(e.target.value)}
                    className={styles.select}
                  >
                    {MOODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={importGenerateImages}
                  onChange={(e) => setImportGenerateImages(e.target.checked)}
                />
                <span>Generate AI images for scenes (uses credits)</span>
              </label>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => setImportStep('input')}
                className={`btn btn-secondary ${styles.cancelBtn}`}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleImportSubmit}
                className={`btn btn-primary ${styles.generateBtn}`}
                disabled={!importProjectName.trim() || analysis.scenes.filter(s => s.selected).length === 0}
              >
                <FilmIcon size={18} />
                Create Project
              </button>
            </div>
          </div>
        )}

        {/* Blank Tab */}
        {activeTab === 'blank' && (
          <div className={styles.tabContent}>
            <div className={styles.header}>
              <div className={styles.headerIconSecondary}>
                <DocumentIcon size={28} color="white" />
              </div>
              <div>
                <h2 className={styles.title}>Start Blank</h2>
                <p className={styles.subtitle}>
                  Create an empty project and add scenes manually.
                </p>
              </div>
            </div>

            <form onSubmit={handleBlankSubmit}>
              <div className={styles.field}>
                <label htmlFor="blankName" className={styles.label}>
                  Project Name <span className={styles.required}>*</span>
                </label>
                <input
                  id="blankName"
                  type="text"
                  value={blankName}
                  onChange={(e) => setBlankName(e.target.value)}
                  placeholder="Enter a name for your project"
                  className={styles.input}
                  autoFocus
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="blankDescription" className={styles.label}>
                  Description (optional)
                </label>
                <textarea
                  id="blankDescription"
                  value={blankDescription}
                  onChange={(e) => setBlankDescription(e.target.value)}
                  placeholder="Describe your project..."
                  className={styles.textarea}
                  rows={3}
                />
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <div className={styles.blankInfo}>
                <p>You&apos;ll be able to:</p>
                <ul>
                  <li>Add scenes with custom prompts</li>
                  <li>Create characters and world lore</li>
                  <li>Generate AI images for each scene</li>
                  <li>Export as PDF storyboard or ZIP</li>
                </ul>
              </div>

              <div className={styles.actions}>
                <button type="button" onClick={handleClose} className={`btn btn-secondary ${styles.cancelBtn}`}>
                  Cancel
                </button>
                <button type="submit" className={`btn btn-primary ${styles.generateBtn}`} disabled={!blankName.trim()}>
                  <DocumentIcon size={18} />
                  Create Project
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

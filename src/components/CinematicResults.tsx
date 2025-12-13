import { useState } from 'react';
import React from 'react';
import { FilmIcon, FilmStripIcon, UsersIcon, GlobeIcon, PaletteIcon, DocumentIcon, BookIcon, LocationIcon, CalendarIcon, CogIcon, BoxIcon, LightbulbIcon, ChartIcon } from './Icons';
import styles from './CinematicResults.module.css';

interface Character {
  name: string;
  role: string;
  description: string;
  archetype: string;
  emotionalArc: string;
  traits: string[];
  visualDescription: string;
  voiceStyle: string;
}

interface Scene {
  sceneNumber: number;
  title: string;
  slugline: string;
  setting: string;
  timeOfDay: string;
  prompt: string;
  screenplay: string;
  shotType: string;
  mood: string;
  lighting: string;
  characters: string[];
  keyActions: string[];
  emotionalBeat: string;
}

interface LoreEntry {
  type: 'location' | 'event' | 'system' | 'object' | 'concept';
  name: string;
  summary: string;
  description: string;
  visualMotifs: string[];
}

interface StyleGuide {
  primaryStyle: string;
  colorPalette: string[];
  lightingApproach: string;
  cameraStyle: string;
  inspirationFilms: string[];
  toneKeywords: string[];
  visualMotifs: string[];
}

interface QualityMetrics {
  narrativeCoherence: number;
  characterDepth: number;
  worldBuilding: number;
  visualClarity: number;
  overallScore: number;
}

interface CinematicResultsProps {
  projectName: string;
  projectDescription?: string;
  logline?: string;
  tagline?: string;
  directorsConcept?: string;
  genre?: string;
  tone?: string;
  visualStyle?: string;
  styleGuide?: StyleGuide;
  characters?: Character[];
  scenes?: Scene[];
  lore?: LoreEntry[];
  qualityMetrics?: QualityMetrics;
  onCreateProject: (generateImages?: boolean) => void;
  onRegenerate: () => void;
  onClose: () => void;
  isCreating?: boolean;
  creationStep?: string;
}

type TabType = 'overview' | 'scenes' | 'characters' | 'world' | 'style';

const LORE_TYPE_ICON_COMPONENTS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  location: LocationIcon,
  event: CalendarIcon,
  system: CogIcon,
  object: BoxIcon,
  concept: LightbulbIcon,
};

export default function CinematicResults({
  projectName,
  projectDescription,
  logline,
  tagline,
  directorsConcept,
  genre,
  tone,
  visualStyle,
  styleGuide,
  characters = [],
  scenes = [],
  lore = [],
  qualityMetrics,
  onCreateProject,
  onRegenerate,
  onClose,
  isCreating = false,
  creationStep = '',
}: CinematicResultsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [expandedScene, setExpandedScene] = useState<number | null>(null);
  const [expandedCharacter, setExpandedCharacter] = useState<string | null>(null);

  const getGradeBadge = (score: number): { grade: string; color: string } => {
    if (score >= 90) return { grade: 'A+', color: '#10b981' };
    if (score >= 85) return { grade: 'A', color: '#10b981' };
    if (score >= 80) return { grade: 'B+', color: '#3b82f6' };
    if (score >= 75) return { grade: 'B', color: '#3b82f6' };
    if (score >= 70) return { grade: 'C+', color: '#f59e0b' };
    if (score >= 65) return { grade: 'C', color: '#f59e0b' };
    return { grade: 'D', color: '#ef4444' };
  };

  const tabs: { id: TabType; label: string; IconComponent: React.FC<{ size?: number; color?: string }>; count?: number }[] = [
    { id: 'overview', label: 'Overview', IconComponent: FilmIcon },
    { id: 'scenes', label: 'Scenes', IconComponent: FilmStripIcon, count: scenes.length },
    { id: 'characters', label: 'Characters', IconComponent: UsersIcon, count: characters.length },
    { id: 'world', label: 'World', IconComponent: GlobeIcon, count: lore.length },
    { id: 'style', label: 'Style Guide', IconComponent: PaletteIcon },
  ];

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>{projectName}</h1>
            {tagline && <p className={styles.tagline}>&ldquo;{tagline}&rdquo;</p>}
            <div className={styles.metaTags}>
              {genre && <span className={styles.metaTag}>{genre}</span>}
              {tone && <span className={styles.metaTag}>{tone}</span>}
              {visualStyle && <span className={styles.metaTag}>{visualStyle}</span>}
            </div>
          </div>
          {qualityMetrics && (
            <div className={styles.qualityBadge} style={{ '--badge-color': getGradeBadge(qualityMetrics.overallScore).color } as React.CSSProperties}>
              <span className={styles.gradeLabel}>Quality</span>
              <span className={styles.gradeValue}>{getGradeBadge(qualityMetrics.overallScore).grade}</span>
              <span className={styles.gradeScore}>{qualityMetrics.overallScore}%</span>
            </div>
          )}
        </header>

        {/* Tabs */}
        <nav className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className={styles.tabIcon}><tab.IconComponent size={18} /></span>
              <span className={styles.tabLabel}>{tab.label}</span>
              {tab.count !== undefined && <span className={styles.tabCount}>{tab.count}</span>}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className={styles.content}>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className={styles.overviewTab}>
              {logline && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}><DocumentIcon size={20} /></span>
                    Logline
                  </h3>
                  <p className={styles.logline}>{logline}</p>
                </section>
              )}

              {projectDescription && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}><BookIcon size={20} /></span>
                    Synopsis
                  </h3>
                  <p className={styles.description}>{projectDescription}</p>
                </section>
              )}

              {directorsConcept && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}><FilmIcon size={20} /></span>
                    Director&apos;s Vision
                  </h3>
                  <blockquote className={styles.directorsConcept}>{directorsConcept}</blockquote>
                </section>
              )}

              {qualityMetrics && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}><ChartIcon size={20} /></span>
                    Quality Metrics
                  </h3>
                  <div className={styles.metricsGrid}>
                    {[
                      { label: 'Narrative', value: qualityMetrics.narrativeCoherence, IconComponent: DocumentIcon },
                      { label: 'Characters', value: qualityMetrics.characterDepth, IconComponent: UsersIcon },
                      { label: 'World', value: qualityMetrics.worldBuilding, IconComponent: GlobeIcon },
                      { label: 'Visuals', value: qualityMetrics.visualClarity, IconComponent: PaletteIcon },
                    ].map((metric) => (
                      <div key={metric.label} className={styles.metricCard}>
                        <span className={styles.metricIcon}><metric.IconComponent size={18} /></span>
                        <span className={styles.metricLabel}>{metric.label}</span>
                        <div className={styles.metricBar}>
                          <div
                            className={styles.metricFill}
                            style={{ width: `${metric.value}%`, backgroundColor: getGradeBadge(metric.value).color }}
                          />
                        </div>
                        <span className={styles.metricValue}>{metric.value}%</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Quick Stats */}
              <div className={styles.quickStats}>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{scenes.length}</span>
                  <span className={styles.statLabel}>Scenes</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{characters.length}</span>
                  <span className={styles.statLabel}>Characters</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{lore.length}</span>
                  <span className={styles.statLabel}>Lore Entries</span>
                </div>
              </div>
            </div>
          )}

          {/* Scenes Tab */}
          {activeTab === 'scenes' && (
            <div className={styles.scenesTab}>
              {scenes.map((scene) => (
                <div
                  key={scene.sceneNumber}
                  className={`${styles.sceneCard} ${expandedScene === scene.sceneNumber ? styles.expanded : ''}`}
                >
                  <button
                    className={styles.sceneHeader}
                    onClick={() => setExpandedScene(expandedScene === scene.sceneNumber ? null : scene.sceneNumber)}
                  >
                    <div className={styles.sceneNumber}>{scene.sceneNumber}</div>
                    <div className={styles.sceneInfo}>
                      <h4 className={styles.sceneTitle}>{scene.title}</h4>
                      <code className={styles.slugline}>{scene.slugline}</code>
                    </div>
                    <div className={styles.sceneMeta}>
                      <span className={styles.sceneMood}>{scene.mood}</span>
                      <span className={styles.sceneShot}>{scene.shotType}</span>
                    </div>
                    <svg
                      className={styles.expandIcon}
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {expandedScene === scene.sceneNumber && (
                    <div className={styles.sceneBody}>
                      <div className={styles.sceneGrid}>
                        <div className={styles.sceneSection}>
                          <h5>Setting</h5>
                          <p>{scene.setting}</p>
                        </div>
                        <div className={styles.sceneSection}>
                          <h5>Lighting</h5>
                          <p>{scene.lighting}</p>
                        </div>
                        <div className={styles.sceneSection}>
                          <h5>Emotional Beat</h5>
                          <p>{scene.emotionalBeat}</p>
                        </div>
                        <div className={styles.sceneSection}>
                          <h5>Characters</h5>
                          <div className={styles.characterTags}>
                            {scene.characters.map((char) => (
                              <span key={char} className={styles.characterTag}>{char}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className={styles.screenplaySection}>
                        <h5>Screenplay</h5>
                        <pre className={styles.screenplay}>{scene.screenplay}</pre>
                      </div>

                      <div className={styles.promptSection}>
                        <h5>Visual Prompt</h5>
                        <p className={styles.visualPrompt}>{scene.prompt}</p>
                      </div>

                      {scene.keyActions.length > 0 && (
                        <div className={styles.actionsSection}>
                          <h5>Key Actions</h5>
                          <ul className={styles.actionsList}>
                            {scene.keyActions.map((action, i) => (
                              <li key={i}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Characters Tab */}
          {activeTab === 'characters' && (
            <div className={styles.charactersTab}>
              {characters.map((character) => (
                <div
                  key={character.name}
                  className={`${styles.characterCard} ${expandedCharacter === character.name ? styles.expanded : ''}`}
                >
                  <button
                    className={styles.characterHeader}
                    onClick={() => setExpandedCharacter(expandedCharacter === character.name ? null : character.name)}
                  >
                    <div className={styles.characterAvatar}>
                      {character.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.characterInfo}>
                      <h4 className={styles.characterName}>{character.name}</h4>
                      <span className={styles.characterRole}>{character.role}</span>
                    </div>
                    <span className={styles.archetype}>{character.archetype}</span>
                    <svg
                      className={styles.expandIcon}
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {expandedCharacter === character.name && (
                    <div className={styles.characterBody}>
                      <div className={styles.characterSection}>
                        <h5>Description</h5>
                        <p>{character.description}</p>
                      </div>

                      <div className={styles.characterSection}>
                        <h5>Emotional Arc</h5>
                        <p className={styles.emotionalArc}>{character.emotionalArc}</p>
                      </div>

                      <div className={styles.characterSection}>
                        <h5>Visual Appearance</h5>
                        <p>{character.visualDescription}</p>
                      </div>

                      <div className={styles.characterSection}>
                        <h5>Voice &amp; Dialogue Style</h5>
                        <p className={styles.voiceStyle}>{character.voiceStyle}</p>
                      </div>

                      <div className={styles.traitsSection}>
                        <h5>Defining Traits</h5>
                        <div className={styles.traitsList}>
                          {character.traits.map((trait) => (
                            <span key={trait} className={styles.trait}>{trait}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* World Tab */}
          {activeTab === 'world' && (
            <div className={styles.worldTab}>
              {lore.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}><GlobeIcon size={32} /></span>
                  <p>No world lore entries generated</p>
                </div>
              ) : (
                lore.map((entry) => (
                  <div key={entry.name} className={styles.loreCard}>
                    <div className={styles.loreHeader}>
                      <span className={styles.loreTypeIcon}>{React.createElement(LORE_TYPE_ICON_COMPONENTS[entry.type] || DocumentIcon, { size: 20 })}</span>
                      <div className={styles.loreInfo}>
                        <h4 className={styles.loreName}>{entry.name}</h4>
                        <span className={styles.loreType}>{entry.type}</span>
                      </div>
                    </div>
                    <p className={styles.loreSummary}>{entry.summary}</p>
                    <p className={styles.loreDescription}>{entry.description}</p>
                    {entry.visualMotifs.length > 0 && (
                      <div className={styles.motifs}>
                        <span className={styles.motifsLabel}>Visual Motifs:</span>
                        {entry.visualMotifs.map((motif) => (
                          <span key={motif} className={styles.motif}>{motif}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Style Guide Tab */}
          {activeTab === 'style' && (
            <div className={styles.styleTab}>
              {!styleGuide ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}><PaletteIcon size={32} /></span>
                  <p>No style guide generated</p>
                </div>
              ) : (
                <>
                  <section className={styles.styleSection}>
                    <h3>Primary Visual Style</h3>
                    <p className={styles.primaryStyle}>{styleGuide.primaryStyle}</p>
                  </section>

                  <section className={styles.styleSection}>
                    <h3>Color Palette</h3>
                    <div className={styles.colorPalette}>
                      {styleGuide.colorPalette.map((color, i) => (
                        <div key={i} className={styles.colorSwatch}>
                          <div
                            className={styles.swatchColor}
                            style={{ backgroundColor: color.startsWith('#') ? color : undefined }}
                          />
                          <span className={styles.colorName}>{color}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className={styles.styleGrid}>
                    <section className={styles.styleSection}>
                      <h3>Lighting Approach</h3>
                      <p>{styleGuide.lightingApproach}</p>
                    </section>

                    <section className={styles.styleSection}>
                      <h3>Camera Style</h3>
                      <p>{styleGuide.cameraStyle}</p>
                    </section>
                  </div>

                  <section className={styles.styleSection}>
                    <h3>Inspiration Films</h3>
                    <div className={styles.filmsList}>
                      {styleGuide.inspirationFilms.map((film) => (
                        <span key={film} className={styles.film}>{film}</span>
                      ))}
                    </div>
                  </section>

                  <section className={styles.styleSection}>
                    <h3>Tone Keywords</h3>
                    <div className={styles.keywordsList}>
                      {styleGuide.toneKeywords.map((keyword) => (
                        <span key={keyword} className={styles.keyword}>{keyword}</span>
                      ))}
                    </div>
                  </section>

                  <section className={styles.styleSection}>
                    <h3>Visual Motifs</h3>
                    <div className={styles.motifsList}>
                      {styleGuide.visualMotifs.map((motif) => (
                        <span key={motif} className={styles.visualMotif}>{motif}</span>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className={styles.footer}>
          {isCreating ? (
            <div className={styles.creatingProgress}>
              <div className={styles.spinner} />
              <span className={styles.creatingText}>{creationStep || 'Creating project...'}</span>
            </div>
          ) : (
            <>
              <button
                className={`btn btn-secondary ${styles.actionBtn}`}
                onClick={onRegenerate}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Regenerate
              </button>
              <button
                className={`btn btn-secondary ${styles.actionBtn}`}
                onClick={() => onCreateProject(false)}
                title="Create project without generating images (faster)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
                Quick Create
              </button>
              <button
                className={`btn btn-primary ${styles.actionBtn}`}
                onClick={() => onCreateProject(true)}
                title="Create project and generate AI images for all scenes"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                Create with Images
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

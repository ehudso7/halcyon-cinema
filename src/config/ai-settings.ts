/**
 * AI Settings Configuration
 *
 * Centralized AI configuration for both StoryForge and Halcyon Cinema.
 * Settings are optimized based on analysis of best-selling works across genres.
 *
 * ARCHITECTURE:
 * - All AI-assisted features MUST use these shared settings
 * - Genre presets are calibrated for optimal output quality
 * - Quality tiers ensure consistent excellence across the platform
 */

// ============================================================================
// Types
// ============================================================================

export interface AIAuthorSettings {
  tone: ToneType;
  style: StyleType;
  pacing: PacingType;
  creativity: number; // 0.0 - 1.0
  verbosity: VerbosityType;
  perspective: PerspectiveType;
  dialogueStyle: DialogueStyleType;
}

export type ToneType =
  | 'neutral'
  | 'formal'
  | 'casual'
  | 'dramatic'
  | 'humorous'
  | 'dark'
  | 'whimsical'
  | 'suspenseful'
  | 'romantic'
  | 'epic';

export type StyleType =
  | 'descriptive'
  | 'minimalist'
  | 'poetic'
  | 'action-oriented'
  | 'dialogue-heavy'
  | 'literary'
  | 'cinematic'
  | 'journalistic'
  | 'stream-of-consciousness';

export type PacingType =
  | 'slow'
  | 'medium'
  | 'fast'
  | 'varied'
  | 'building';

export type VerbosityType =
  | 'concise'
  | 'balanced'
  | 'detailed'
  | 'elaborate';

export type PerspectiveType =
  | 'first-person'
  | 'third-person-limited'
  | 'third-person-omniscient'
  | 'second-person';

export type DialogueStyleType =
  | 'natural'
  | 'stylized'
  | 'minimal'
  | 'subtext-heavy'
  | 'witty';

export type GenreType =
  | 'fantasy'
  | 'science-fiction'
  | 'romance'
  | 'thriller'
  | 'mystery'
  | 'horror'
  | 'literary-fiction'
  | 'historical-fiction'
  | 'young-adult'
  | 'action-adventure'
  | 'drama'
  | 'comedy'
  | 'documentary'
  | 'noir';

export type QualityTier = 'standard' | 'professional' | 'premium';

export interface GenrePreset {
  id: GenreType;
  name: string;
  description: string;
  settings: AIAuthorSettings;
  systemPromptModifier: string;
  cinematicStyle?: string;
}

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_AI_SETTINGS: AIAuthorSettings = {
  tone: 'neutral',
  style: 'descriptive',
  pacing: 'medium',
  creativity: 0.7,
  verbosity: 'balanced',
  perspective: 'third-person-limited',
  dialogueStyle: 'natural',
};

// ============================================================================
// Genre Presets
// Optimized based on analysis of best-selling works in each genre
// ============================================================================

export const GENRE_PRESETS: Record<GenreType, GenrePreset> = {
  'fantasy': {
    id: 'fantasy',
    name: 'Fantasy',
    description: 'Epic worlds, magic systems, and heroic journeys',
    settings: {
      tone: 'epic',
      style: 'descriptive',
      pacing: 'building',
      creativity: 0.85,
      verbosity: 'detailed',
      perspective: 'third-person-limited',
      dialogueStyle: 'stylized',
    },
    systemPromptModifier: 'Write in the tradition of epic fantasy, with rich world-building, vivid magical elements, and archetypal character journeys. Balance wonder with emotional grounding. Use evocative language for settings and magic while keeping character voices distinct.',
    cinematicStyle: 'epic fantasy, sweeping landscapes, magical lighting, detailed costumes',
  },

  'science-fiction': {
    id: 'science-fiction',
    name: 'Science Fiction',
    description: 'Futuristic technology, space exploration, and speculative concepts',
    settings: {
      tone: 'dramatic',
      style: 'cinematic',
      pacing: 'varied',
      creativity: 0.8,
      verbosity: 'balanced',
      perspective: 'third-person-limited',
      dialogueStyle: 'natural',
    },
    systemPromptModifier: 'Write intelligent science fiction that balances speculative concepts with human drama. Ground futuristic elements in plausible science while exploring philosophical and social implications. Technical details should serve the story, not overshadow it.',
    cinematicStyle: 'futuristic, high-tech environments, dramatic lighting, sleek design',
  },

  'romance': {
    id: 'romance',
    name: 'Romance',
    description: 'Love stories with emotional depth and satisfying relationships',
    settings: {
      tone: 'romantic',
      style: 'descriptive',
      pacing: 'building',
      creativity: 0.75,
      verbosity: 'detailed',
      perspective: 'first-person',
      dialogueStyle: 'subtext-heavy',
    },
    systemPromptModifier: 'Write emotionally resonant romance with authentic character chemistry. Focus on the gradual building of connection through meaningful interactions, internal conflict, and emotional vulnerability. Balance tension with tender moments. Dialogue should crackle with subtext.',
    cinematicStyle: 'warm lighting, intimate framing, soft focus, romantic atmosphere',
  },

  'thriller': {
    id: 'thriller',
    name: 'Thriller',
    description: 'High-stakes suspense with constant tension and twists',
    settings: {
      tone: 'suspenseful',
      style: 'action-oriented',
      pacing: 'fast',
      creativity: 0.7,
      verbosity: 'concise',
      perspective: 'third-person-limited',
      dialogueStyle: 'natural',
    },
    systemPromptModifier: 'Write taut, propulsive thriller prose that maintains constant forward momentum. Every scene should raise stakes or reveal information. Use short, punchy sentences during action. Plant clues subtly. Create protagonists readers root for against formidable antagonists.',
    cinematicStyle: 'high contrast, dynamic angles, urban environments, tense atmosphere',
  },

  'mystery': {
    id: 'mystery',
    name: 'Mystery',
    description: 'Puzzle-driven narratives with clues and revelations',
    settings: {
      tone: 'suspenseful',
      style: 'literary',
      pacing: 'building',
      creativity: 0.65,
      verbosity: 'balanced',
      perspective: 'first-person',
      dialogueStyle: 'witty',
    },
    systemPromptModifier: 'Write engaging mystery with fair play—plant clues readers can find on re-read. Create an intriguing detective voice. Build atmosphere through setting details. Each interrogation and discovery should reveal character while advancing the puzzle. Misdirect without cheating.',
    cinematicStyle: 'moody lighting, detailed environments, observational framing, atmospheric',
  },

  'horror': {
    id: 'horror',
    name: 'Horror',
    description: 'Fear, dread, and psychological terror',
    settings: {
      tone: 'dark',
      style: 'descriptive',
      pacing: 'building',
      creativity: 0.8,
      verbosity: 'detailed',
      perspective: 'first-person',
      dialogueStyle: 'natural',
    },
    systemPromptModifier: 'Write horror that builds dread through atmosphere and implication. Use sensory details to create unease. The unknown is scarier than the revealed. Ground supernatural elements in psychological reality. Characters should make believable choices that lead to terrible consequences.',
    cinematicStyle: 'low-key lighting, shadows, confined spaces, unsettling compositions',
  },

  'literary-fiction': {
    id: 'literary-fiction',
    name: 'Literary Fiction',
    description: 'Character-driven narratives with thematic depth',
    settings: {
      tone: 'neutral',
      style: 'literary',
      pacing: 'slow',
      creativity: 0.9,
      verbosity: 'elaborate',
      perspective: 'third-person-omniscient',
      dialogueStyle: 'subtext-heavy',
    },
    systemPromptModifier: 'Write literary fiction with attention to prose quality, thematic resonance, and psychological depth. Explore the human condition through specific, observed detail. Allow meaning to emerge through pattern and juxtaposition rather than exposition. Every sentence should do multiple jobs.',
    cinematicStyle: 'naturalistic lighting, contemplative pacing, symbolic imagery, artistic composition',
  },

  'historical-fiction': {
    id: 'historical-fiction',
    name: 'Historical Fiction',
    description: 'Period settings with authentic historical detail',
    settings: {
      tone: 'dramatic',
      style: 'descriptive',
      pacing: 'medium',
      creativity: 0.7,
      verbosity: 'detailed',
      perspective: 'third-person-limited',
      dialogueStyle: 'stylized',
    },
    systemPromptModifier: 'Write historical fiction that immerses readers in the period through authentic detail without overwhelming exposition. Characters should have period-appropriate worldviews while remaining relatable. Balance historical accuracy with narrative drive. Let the era inform but not dictate the story.',
    cinematicStyle: 'period-accurate settings, warm film grain, classical composition, authentic costumes',
  },

  'young-adult': {
    id: 'young-adult',
    name: 'Young Adult',
    description: 'Coming-of-age stories with relatable teen protagonists',
    settings: {
      tone: 'dramatic',
      style: 'dialogue-heavy',
      pacing: 'fast',
      creativity: 0.75,
      verbosity: 'balanced',
      perspective: 'first-person',
      dialogueStyle: 'natural',
    },
    systemPromptModifier: 'Write YA with an authentic teen voice that respects reader intelligence. Focus on identity formation, first experiences, and emotional intensity. Stakes should feel world-ending even if objectively smaller. Pace for engagement while allowing emotional beats to land.',
    cinematicStyle: 'vibrant colors, dynamic movement, youthful energy, contemporary settings',
  },

  'action-adventure': {
    id: 'action-adventure',
    name: 'Action Adventure',
    description: 'Thrilling escapades with heroic protagonists',
    settings: {
      tone: 'dramatic',
      style: 'action-oriented',
      pacing: 'fast',
      creativity: 0.75,
      verbosity: 'concise',
      perspective: 'third-person-limited',
      dialogueStyle: 'witty',
    },
    systemPromptModifier: 'Write propulsive action-adventure with set-pieces that escalate in creativity and stakes. Heroes should be competent but challenged. Use geography and environment as active story elements. Balance spectacle with character moments. Wit should punctuate tension.',
    cinematicStyle: 'dynamic action, wide vistas, bold colors, heroic framing',
  },

  'drama': {
    id: 'drama',
    name: 'Drama',
    description: 'Emotionally resonant character studies',
    settings: {
      tone: 'dramatic',
      style: 'literary',
      pacing: 'medium',
      creativity: 0.8,
      verbosity: 'balanced',
      perspective: 'third-person-limited',
      dialogueStyle: 'subtext-heavy',
    },
    systemPromptModifier: 'Write drama focused on emotional truth and character complexity. Conflict should arise from competing valid needs. Avoid melodrama through specificity and restraint. Let silence and gesture carry as much weight as dialogue. Every character believes they are the protagonist.',
    cinematicStyle: 'naturalistic lighting, intimate framing, subtle performances, emotional depth',
  },

  'comedy': {
    id: 'comedy',
    name: 'Comedy',
    description: 'Humor-driven narratives with wit and timing',
    settings: {
      tone: 'humorous',
      style: 'dialogue-heavy',
      pacing: 'fast',
      creativity: 0.85,
      verbosity: 'concise',
      perspective: 'first-person',
      dialogueStyle: 'witty',
    },
    systemPromptModifier: 'Write comedy with strong comic voice and impeccable timing. Layer jokes—setup, misdirect, payoff. Characters should be funny because of who they are, not just what they say. Ground absurdity in emotional reality. The best comedy has heart beneath the laughs.',
    cinematicStyle: 'bright lighting, expressive framing, comedic timing, energetic atmosphere',
  },

  'documentary': {
    id: 'documentary',
    name: 'Documentary',
    description: 'Factual narratives with compelling storytelling',
    settings: {
      tone: 'neutral',
      style: 'journalistic',
      pacing: 'medium',
      creativity: 0.5,
      verbosity: 'balanced',
      perspective: 'third-person-omniscient',
      dialogueStyle: 'natural',
    },
    systemPromptModifier: 'Write documentary-style narrative that presents facts compellingly without editorializing. Let subjects speak in their own voices. Build narrative through careful sequencing of information. Create emotional engagement through specificity and human detail rather than manipulation.',
    cinematicStyle: 'naturalistic lighting, observational framing, real locations, authentic atmosphere',
  },

  'noir': {
    id: 'noir',
    name: 'Noir',
    description: 'Dark, morally complex stories with atmospheric style',
    settings: {
      tone: 'dark',
      style: 'cinematic',
      pacing: 'medium',
      creativity: 0.8,
      verbosity: 'balanced',
      perspective: 'first-person',
      dialogueStyle: 'stylized',
    },
    systemPromptModifier: 'Write noir with a distinctive voice dripping with atmosphere and moral ambiguity. Characters should be flawed and compelling. Use environment as character. Dialogue should crackle with subtext and period-appropriate snap. Embrace pessimism without nihilism—there must be something worth fighting for.',
    cinematicStyle: 'high contrast, deep shadows, rain-slicked streets, dramatic chiaroscuro',
  },
};

// ============================================================================
// Quality Tier Settings
// ============================================================================

export interface QualitySettings {
  maxTokens: number;
  baseTemperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  systemPromptAddition: string;
}

export const QUALITY_TIERS: Record<QualityTier, QualitySettings> = {
  standard: {
    maxTokens: 2000,
    baseTemperature: 0.7,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    systemPromptAddition: '',
  },
  professional: {
    maxTokens: 3000,
    baseTemperature: 0.75,
    topP: 0.95,
    frequencyPenalty: 0.3,
    presencePenalty: 0.3,
    systemPromptAddition: 'Ensure professional-grade output with attention to craft, consistency, and reader engagement. Avoid clichés and predictable patterns.',
  },
  premium: {
    maxTokens: 4000,
    baseTemperature: 0.8,
    topP: 0.9,
    frequencyPenalty: 0.5,
    presencePenalty: 0.5,
    systemPromptAddition: 'Produce publication-ready prose of the highest literary quality. Every word choice should be deliberate. Create prose that surprises and delights while serving the story. Match the quality of award-winning published work in this genre.',
  },
};

/**
 * Credit costs per quality tier.
 * Shared between frontend (display) and backend (billing).
 */
export const TIER_CREDITS: Record<QualityTier, number> = {
  standard: 1,
  professional: 2,
  premium: 3,
};

// ============================================================================
// System Prompts
// ============================================================================

const BASE_WRITER_PROMPT = `You are an expert creative writer with deep knowledge of narrative craft, character development, and prose style. Your writing demonstrates:

- **Voice**: Distinctive, consistent authorial voice appropriate to genre and tone
- **Character**: Multi-dimensional characters with clear motivations and authentic dialogue
- **Pacing**: Expert control of narrative rhythm, tension, and release
- **Description**: Sensory-rich, evocative prose that immerses readers
- **Structure**: Strong scene construction with clear purpose and momentum
- **Theme**: Layered meaning that emerges naturally from story elements`;

const BASE_CINEMA_PROMPT = `You are an expert visual storyteller with deep knowledge of cinematography, composition, and visual narrative. Your descriptions demonstrate:

- **Composition**: Expert framing that guides the viewer's eye and conveys meaning
- **Lighting**: Sophisticated use of light to create mood and atmosphere
- **Color**: Intentional color palettes that reinforce emotional content
- **Movement**: Dynamic visual flow appropriate to narrative beat
- **Detail**: Specific, evocative details that bring scenes to life
- **Continuity**: Visual consistency across related scenes`;

export function buildSystemPrompt(
  settings: AIAuthorSettings,
  genre?: GenreType,
  qualityTier: QualityTier = 'professional',
  mode: 'storyforge' | 'cinema' = 'storyforge'
): string {
  const basePrompt = mode === 'cinema' ? BASE_CINEMA_PROMPT : BASE_WRITER_PROMPT;
  const qualityAddition = QUALITY_TIERS[qualityTier].systemPromptAddition;
  const genreModifier = genre ? GENRE_PRESETS[genre]?.systemPromptModifier || '' : '';

  const styleInstructions = buildStyleInstructions(settings);

  const parts = [
    basePrompt,
    '',
    '## Style Guidelines',
    styleInstructions,
  ];

  if (genreModifier) {
    parts.push('', '## Genre-Specific Guidance', genreModifier);
  }

  if (qualityAddition) {
    parts.push('', '## Quality Standards', qualityAddition);
  }

  return parts.join('\n');
}

function buildStyleInstructions(settings: AIAuthorSettings): string {
  const instructions: string[] = [];

  // Tone
  const toneDescriptions: Record<ToneType, string> = {
    neutral: 'Maintain a balanced, objective tone',
    formal: 'Use formal, elevated language with precise diction',
    casual: 'Write in a relaxed, conversational style',
    dramatic: 'Heighten emotional intensity and stakes',
    humorous: 'Infuse wit and comedic timing throughout',
    dark: 'Embrace shadows, moral complexity, and unease',
    whimsical: 'Add playful, imaginative, fantastical elements',
    suspenseful: 'Build and maintain tension through uncertainty',
    romantic: 'Focus on emotional connection and intimate moments',
    epic: 'Embrace grandeur, heroism, and sweeping scope',
  };
  instructions.push(`**Tone**: ${toneDescriptions[settings.tone]}`);

  // Style
  const styleDescriptions: Record<StyleType, string> = {
    descriptive: 'Rich, detailed prose that paints vivid pictures',
    minimalist: 'Spare, precise prose where every word earns its place',
    poetic: 'Lyrical language with attention to rhythm and sound',
    'action-oriented': 'Propulsive prose focused on movement and momentum',
    'dialogue-heavy': 'Let characters drive scenes through conversation',
    literary: 'Sophisticated prose with layered meaning and subtext',
    cinematic: 'Visual, scene-based writing that reads like a film',
    journalistic: 'Clear, factual prose focused on accuracy and clarity',
    'stream-of-consciousness': 'Flowing, associative internal narrative',
  };
  instructions.push(`**Style**: ${styleDescriptions[settings.style]}`);

  // Pacing
  const pacingDescriptions: Record<PacingType, string> = {
    slow: 'Deliberate pacing that allows moments to breathe',
    medium: 'Balanced rhythm between action and reflection',
    fast: 'Quick, propulsive pacing that maintains momentum',
    varied: 'Dynamic pacing that shifts with narrative needs',
    building: 'Gradual acceleration toward climactic moments',
  };
  instructions.push(`**Pacing**: ${pacingDescriptions[settings.pacing]}`);

  // Verbosity
  const verbosityDescriptions: Record<VerbosityType, string> = {
    concise: 'Economical prose—say more with less',
    balanced: 'Appropriate detail without excess',
    detailed: 'Rich description and thorough exploration',
    elaborate: 'Expansive, immersive detail throughout',
  };
  instructions.push(`**Detail Level**: ${verbosityDescriptions[settings.verbosity]}`);

  // Perspective
  const perspectiveDescriptions: Record<PerspectiveType, string> = {
    'first-person': 'First-person POV with intimate access to narrator thoughts',
    'third-person-limited': 'Third-person limited to one character\'s perspective per scene',
    'third-person-omniscient': 'Third-person omniscient with access to all characters',
    'second-person': 'Second-person "you" narrative (use sparingly)',
  };
  instructions.push(`**Perspective**: ${perspectiveDescriptions[settings.perspective]}`);

  // Dialogue
  const dialogueDescriptions: Record<DialogueStyleType, string> = {
    natural: 'Realistic dialogue that sounds like real speech',
    stylized: 'Heightened, distinctive dialogue with clear voice',
    minimal: 'Sparse dialogue—let action and description carry weight',
    'subtext-heavy': 'Dialogue where meaning lies beneath the surface',
    witty: 'Sharp, clever dialogue with quick exchanges',
  };
  instructions.push(`**Dialogue**: ${dialogueDescriptions[settings.dialogueStyle]}`);

  return instructions.join('\n');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get optimal settings for a genre
 */
export function getGenreSettings(genre: GenreType): AIAuthorSettings {
  return GENRE_PRESETS[genre]?.settings || DEFAULT_AI_SETTINGS;
}

/**
 * Get cinematic style guidance for a genre
 */
export function getCinematicStyle(genre: GenreType): string {
  return GENRE_PRESETS[genre]?.cinematicStyle || 'cinematic, professional, high quality';
}

/**
 * Calculate effective temperature from creativity setting
 */
export function calculateTemperature(
  creativity: number,
  qualityTier: QualityTier = 'professional'
): number {
  const baseTemp = QUALITY_TIERS[qualityTier].baseTemperature;
  // Scale creativity (0-1) to temperature adjustment (-0.25 to +0.25)
  const adjustment = (creativity - 0.5) * 0.5;
  return Math.max(0.0, Math.min(2.0, baseTemp + adjustment));
}

/**
 * Get all available genres
 */
export function getAvailableGenres(): GenrePreset[] {
  return Object.values(GENRE_PRESETS);
}

/**
 * Validate AI settings
 */
export function validateAISettings(settings: Partial<AIAuthorSettings>): AIAuthorSettings {
  return {
    tone: settings.tone || DEFAULT_AI_SETTINGS.tone,
    style: settings.style || DEFAULT_AI_SETTINGS.style,
    pacing: settings.pacing || DEFAULT_AI_SETTINGS.pacing,
    creativity: Math.max(0, Math.min(1, settings.creativity ?? DEFAULT_AI_SETTINGS.creativity)),
    verbosity: settings.verbosity || DEFAULT_AI_SETTINGS.verbosity,
    perspective: settings.perspective || DEFAULT_AI_SETTINGS.perspective,
    dialogueStyle: settings.dialogueStyle || DEFAULT_AI_SETTINGS.dialogueStyle,
  };
}

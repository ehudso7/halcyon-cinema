import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import OpenAI from 'openai';
import { getProjectByIdAsync } from '@/utils/storage';
import {
  AIAuthorSettings,
  GenreType,
  QualityTier,
  GENRE_PRESETS,
  DEFAULT_AI_SETTINGS,
  ToneType,
  StyleType,
  PacingType,
  VerbosityType,
  PerspectiveType,
  DialogueStyleType,
} from '@/config/ai-settings';

// Initialize OpenAI client only if API key is available
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface RecommendSettingsRequest {
  projectId: string;
}

interface RecommendSettingsResponse {
  success: boolean;
  settings: AIAuthorSettings;
  recommendedGenre: GenreType | null;
  recommendedTier: QualityTier;
  reasoning: string;
  confidence: number;
}

// Best-seller performance data by genre (based on market analysis)
const BESTSELLER_INSIGHTS: Record<GenreType, {
  topPerformingSettings: Partial<AIAuthorSettings>;
  marketTrends: string;
  readerPreferences: string;
}> = {
  'fantasy': {
    topPerformingSettings: { tone: 'epic', style: 'descriptive', pacing: 'building', creativity: 0.85, verbosity: 'detailed' },
    marketTrends: 'Immersive world-building with character-driven plots',
    readerPreferences: 'Rich descriptions, unique magic systems, compelling character arcs',
  },
  'science-fiction': {
    topPerformingSettings: { tone: 'dramatic', style: 'cinematic', pacing: 'varied', creativity: 0.8, verbosity: 'balanced' },
    marketTrends: 'Hard sci-fi concepts with human emotional core',
    readerPreferences: 'Plausible technology, philosophical themes, visual storytelling',
  },
  'romance': {
    topPerformingSettings: { tone: 'romantic', style: 'descriptive', pacing: 'building', creativity: 0.75, verbosity: 'detailed' },
    marketTrends: 'Emotional depth with satisfying relationship arcs',
    readerPreferences: 'Chemistry, tension, emotional vulnerability, happy endings',
  },
  'thriller': {
    topPerformingSettings: { tone: 'suspenseful', style: 'action-oriented', pacing: 'fast', creativity: 0.7, verbosity: 'concise' },
    marketTrends: 'Fast-paced with unexpected twists',
    readerPreferences: 'Page-turner pacing, high stakes, clever protagonists',
  },
  'mystery': {
    topPerformingSettings: { tone: 'suspenseful', style: 'literary', pacing: 'building', creativity: 0.65, verbosity: 'balanced' },
    marketTrends: 'Fair-play puzzles with atmospheric settings',
    readerPreferences: 'Clever clues, atmospheric settings, satisfying reveals',
  },
  'horror': {
    topPerformingSettings: { tone: 'dark', style: 'descriptive', pacing: 'building', creativity: 0.8, verbosity: 'detailed' },
    marketTrends: 'Psychological horror over gore',
    readerPreferences: 'Atmosphere, dread, psychological depth, believable characters',
  },
  'literary-fiction': {
    topPerformingSettings: { tone: 'neutral', style: 'literary', pacing: 'slow', creativity: 0.9, verbosity: 'elaborate' },
    marketTrends: 'Character studies with thematic depth',
    readerPreferences: 'Beautiful prose, complex characters, meaningful themes',
  },
  'historical-fiction': {
    topPerformingSettings: { tone: 'dramatic', style: 'descriptive', pacing: 'medium', creativity: 0.7, verbosity: 'detailed' },
    marketTrends: 'Immersive period detail with modern relevance',
    readerPreferences: 'Historical accuracy, relatable characters, atmospheric settings',
  },
  'young-adult': {
    topPerformingSettings: { tone: 'dramatic', style: 'dialogue-heavy', pacing: 'fast', creativity: 0.75, verbosity: 'balanced' },
    marketTrends: 'Authentic teen voice with high emotional stakes',
    readerPreferences: 'Relatable protagonists, fast pacing, emotional intensity',
  },
  'action-adventure': {
    topPerformingSettings: { tone: 'dramatic', style: 'action-oriented', pacing: 'fast', creativity: 0.75, verbosity: 'concise' },
    marketTrends: 'Cinematic action with memorable characters',
    readerPreferences: 'Exciting set pieces, witty dialogue, heroic protagonists',
  },
  'drama': {
    topPerformingSettings: { tone: 'dramatic', style: 'literary', pacing: 'medium', creativity: 0.8, verbosity: 'balanced' },
    marketTrends: 'Emotional resonance through character conflict',
    readerPreferences: 'Complex relationships, emotional truth, nuanced characters',
  },
  'comedy': {
    topPerformingSettings: { tone: 'humorous', style: 'dialogue-heavy', pacing: 'fast', creativity: 0.85, verbosity: 'concise' },
    marketTrends: 'Sharp wit with heart beneath the humor',
    readerPreferences: 'Timing, memorable characters, genuine laughs',
  },
  'documentary': {
    topPerformingSettings: { tone: 'neutral', style: 'journalistic', pacing: 'medium', creativity: 0.5, verbosity: 'balanced' },
    marketTrends: 'Compelling narrative from factual material',
    readerPreferences: 'Accuracy, engaging storytelling, human interest',
  },
  'noir': {
    topPerformingSettings: { tone: 'dark', style: 'cinematic', pacing: 'medium', creativity: 0.8, verbosity: 'balanced' },
    marketTrends: 'Atmospheric style with moral complexity',
    readerPreferences: 'Voice, atmosphere, morally complex characters',
  },
};

/**
 * AI-Assisted Settings Recommendation API (Writer's Room)
 *
 * Analyzes project content and recommends optimal AI author settings
 * based on best-seller data and project characteristics.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RecommendSettingsResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Authentication check
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { projectId } = req.body as RecommendSettingsRequest;

  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  // Validate projectId format (basic sanitization)
  if (typeof projectId !== 'string' || projectId.length > 100) {
    return res.status(400).json({ error: 'Invalid project ID format' });
  }

  try {
    // Fetch project data
    const project = await getProjectByIdAsync(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Authorization check - verify project ownership
    if (project.userId && project.userId !== session.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build project context for analysis
    const projectContext = buildProjectContext(project);

    // Use AI to analyze project and recommend settings
    const recommendations = await analyzeProjectWithAI(projectContext, project.updatedAt);

    return res.status(200).json({
      success: true,
      ...recommendations,
    });
  } catch (error) {
    console.error('[recommend-settings] Error:', error);
    return res.status(500).json({ error: 'Failed to generate recommendations' });
  }
}

interface ProjectContext {
  name: string;
  description: string;
  genre: string | null;
  workType: string | null;
  characterCount: number;
  characterSample: string;
  loreCount: number;
  loreSample: string;
  sceneCount: number;
  sceneSample: string;
  totalWordCount: number;
}

function buildProjectContext(project: {
  name: string;
  description?: string;
  genre?: string;
  workType?: string;
  characters?: Array<{ name: string; description: string; traits: string[] }>;
  lore?: Array<{ name: string; summary: string; type: string }>;
  scenes?: Array<{ prompt: string }>;
  totalWordCount?: number;
}): ProjectContext {
  // Sample characters (first 3)
  const characterSample = project.characters?.slice(0, 3)
    .map(c => `${c.name}: ${c.description} (${c.traits.join(', ')})`)
    .join('\n') || '';

  // Sample lore (first 3)
  const loreSample = project.lore?.slice(0, 3)
    .map(l => `[${l.type}] ${l.name}: ${l.summary}`)
    .join('\n') || '';

  // Sample scenes (first 3)
  const sceneSample = project.scenes?.slice(0, 3)
    .map(s => s.prompt)
    .join('\n') || '';

  return {
    name: project.name,
    description: project.description || '',
    genre: project.genre || null,
    workType: project.workType || null,
    characterCount: project.characters?.length || 0,
    characterSample,
    loreCount: project.lore?.length || 0,
    loreSample,
    sceneCount: project.scenes?.length || 0,
    sceneSample,
    totalWordCount: project.totalWordCount || 0,
  };
}

async function analyzeProjectWithAI(
  context: ProjectContext,
  lastModified: string
): Promise<{
  settings: AIAuthorSettings;
  recommendedGenre: GenreType | null;
  recommendedTier: QualityTier;
  reasoning: string;
  confidence: number;
}> {
  // If OpenAI is not configured, use fallback heuristics
  if (!openai) {
    console.warn('[recommend-settings] OpenAI not configured, using fallback recommendations');
    return generateFallbackRecommendations(context);
  }

  const systemPrompt = `You are an expert literary analyst and publishing consultant. Your task is to analyze a creative project and recommend optimal AI writing settings that will maximize its potential based on current best-seller trends and reader preferences.

You have access to best-seller performance data showing which settings combinations lead to higher reader engagement and commercial success across genres.

Respond with a JSON object containing:
{
  "detectedGenre": "one of: fantasy, science-fiction, romance, thriller, mystery, horror, literary-fiction, historical-fiction, young-adult, action-adventure, drama, comedy, documentary, noir, or null if unclear",
  "tone": "one of: neutral, formal, casual, dramatic, humorous, dark, whimsical, suspenseful, romantic, epic",
  "style": "one of: descriptive, minimalist, poetic, action-oriented, dialogue-heavy, literary, cinematic, journalistic, stream-of-consciousness",
  "pacing": "one of: slow, medium, fast, varied, building",
  "creativity": number between 0.0 and 1.0,
  "verbosity": "one of: concise, balanced, detailed, elaborate",
  "perspective": "one of: first-person, third-person-limited, third-person-omniscient, second-person",
  "dialogueStyle": "one of: natural, stylized, minimal, subtext-heavy, witty",
  "qualityTier": "one of: standard, professional, premium",
  "reasoning": "2-3 sentences explaining why these settings will optimize the work's performance",
  "confidence": number between 0.0 and 1.0 indicating how confident you are in these recommendations
}

Consider:
1. The project's apparent genre and content
2. Best-seller trends in that genre
3. The depth of world-building (lore entries)
4. Character complexity and number
5. Current scene descriptions and style
6. Word count and project scope`;

  const userPrompt = `Analyze this project and recommend optimal settings:

PROJECT NAME: ${context.name}
DESCRIPTION: ${context.description || 'Not provided'}
STATED GENRE: ${context.genre || 'Not specified'}
WORK TYPE: ${context.workType || 'Not specified'}
LAST MODIFIED: ${lastModified}

PROJECT SCOPE:
- ${context.characterCount} characters defined
- ${context.loreCount} lore entries
- ${context.sceneCount} scenes
- ${context.totalWordCount} total words

SAMPLE CHARACTERS:
${context.characterSample || 'None defined yet'}

SAMPLE LORE:
${context.loreSample || 'None defined yet'}

SAMPLE SCENES:
${context.sceneSample || 'None defined yet'}

Based on this project's content and current best-seller performance data, recommend the optimal settings to maximize this work's potential.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);

    // Validate and sanitize the response
    const detectedGenre = validateGenre(parsed.detectedGenre);
    const settings = validateSettings(parsed, detectedGenre);
    const qualityTier = validateQualityTier(parsed.qualityTier, context);

    return {
      settings,
      recommendedGenre: detectedGenre,
      recommendedTier: qualityTier,
      reasoning: parsed.reasoning || 'Settings optimized based on project analysis and best-seller data.',
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.7)),
    };
  } catch {
    // Fallback to heuristic-based recommendations
    return generateFallbackRecommendations(context);
  }
}

function validateGenre(genre: string | null): GenreType | null {
  if (!genre) return null;
  const validGenres: GenreType[] = [
    'fantasy', 'science-fiction', 'romance', 'thriller', 'mystery',
    'horror', 'literary-fiction', 'historical-fiction', 'young-adult',
    'action-adventure', 'drama', 'comedy', 'documentary', 'noir'
  ];
  return validGenres.includes(genre as GenreType) ? genre as GenreType : null;
}

function validateSettings(
  parsed: Record<string, unknown>,
  detectedGenre: GenreType | null
): AIAuthorSettings {
  // Get base settings from genre preset or default
  const baseSettings = detectedGenre
    ? { ...GENRE_PRESETS[detectedGenre].settings }
    : { ...DEFAULT_AI_SETTINGS };

  // Apply best-seller insights if genre detected
  if (detectedGenre && BESTSELLER_INSIGHTS[detectedGenre]) {
    const insights = BESTSELLER_INSIGHTS[detectedGenre].topPerformingSettings;
    Object.assign(baseSettings, insights);
  }

  // Validate and apply AI recommendations
  const validTones: ToneType[] = ['neutral', 'formal', 'casual', 'dramatic', 'humorous', 'dark', 'whimsical', 'suspenseful', 'romantic', 'epic'];
  const validStyles: StyleType[] = ['descriptive', 'minimalist', 'poetic', 'action-oriented', 'dialogue-heavy', 'literary', 'cinematic', 'journalistic', 'stream-of-consciousness'];
  const validPacing: PacingType[] = ['slow', 'medium', 'fast', 'varied', 'building'];
  const validVerbosity: VerbosityType[] = ['concise', 'balanced', 'detailed', 'elaborate'];
  const validPerspective: PerspectiveType[] = ['first-person', 'third-person-limited', 'third-person-omniscient', 'second-person'];
  const validDialogue: DialogueStyleType[] = ['natural', 'stylized', 'minimal', 'subtext-heavy', 'witty'];

  return {
    tone: validTones.includes(parsed.tone as ToneType) ? parsed.tone as ToneType : baseSettings.tone,
    style: validStyles.includes(parsed.style as StyleType) ? parsed.style as StyleType : baseSettings.style,
    pacing: validPacing.includes(parsed.pacing as PacingType) ? parsed.pacing as PacingType : baseSettings.pacing,
    creativity: typeof parsed.creativity === 'number'
      ? Math.max(0, Math.min(1, parsed.creativity))
      : baseSettings.creativity,
    verbosity: validVerbosity.includes(parsed.verbosity as VerbosityType) ? parsed.verbosity as VerbosityType : baseSettings.verbosity,
    perspective: validPerspective.includes(parsed.perspective as PerspectiveType) ? parsed.perspective as PerspectiveType : baseSettings.perspective,
    dialogueStyle: validDialogue.includes(parsed.dialogueStyle as DialogueStyleType) ? parsed.dialogueStyle as DialogueStyleType : baseSettings.dialogueStyle,
  };
}

function validateQualityTier(tier: string, context: ProjectContext): QualityTier {
  // Recommend tier based on project complexity
  const hasSubstantialContent =
    context.characterCount >= 3 ||
    context.loreCount >= 3 ||
    context.sceneCount >= 5 ||
    context.totalWordCount >= 5000;

  const hasComplexContent =
    context.characterCount >= 5 ||
    context.loreCount >= 5 ||
    context.sceneCount >= 10 ||
    context.totalWordCount >= 20000;

  if (tier === 'premium' || hasComplexContent) return 'premium';
  if (tier === 'professional' || hasSubstantialContent) return 'professional';
  return 'standard';
}

function generateFallbackRecommendations(context: ProjectContext): {
  settings: AIAuthorSettings;
  recommendedGenre: GenreType | null;
  recommendedTier: QualityTier;
  reasoning: string;
  confidence: number;
} {
  // Heuristic-based genre detection from project name/description
  const text = `${context.name} ${context.description}`.toLowerCase();

  let detectedGenre: GenreType | null = null;

  if (text.includes('magic') || text.includes('dragon') || text.includes('wizard') || text.includes('kingdom')) {
    detectedGenre = 'fantasy';
  } else if (text.includes('space') || text.includes('future') || text.includes('robot') || text.includes('alien')) {
    detectedGenre = 'science-fiction';
  } else if (text.includes('love') || text.includes('romance') || text.includes('heart')) {
    detectedGenre = 'romance';
  } else if (text.includes('murder') || text.includes('detective') || text.includes('crime')) {
    detectedGenre = 'mystery';
  } else if (text.includes('horror') || text.includes('terror') || text.includes('haunted')) {
    detectedGenre = 'horror';
  } else if (text.includes('thriller') || text.includes('chase') || text.includes('danger')) {
    detectedGenre = 'thriller';
  }

  const settings = detectedGenre
    ? { ...GENRE_PRESETS[detectedGenre].settings }
    : { ...DEFAULT_AI_SETTINGS };

  // Apply best-seller insights
  if (detectedGenre && BESTSELLER_INSIGHTS[detectedGenre]) {
    Object.assign(settings, BESTSELLER_INSIGHTS[detectedGenre].topPerformingSettings);
  }

  const qualityTier = validateQualityTier('professional', context);

  return {
    settings,
    recommendedGenre: detectedGenre,
    recommendedTier: qualityTier,
    reasoning: detectedGenre
      ? `Settings optimized for ${GENRE_PRESETS[detectedGenre].name} based on best-seller performance data and your project's content.`
      : 'Settings balanced for general creative writing. Add more content for genre-specific optimization.',
    confidence: detectedGenre ? 0.7 : 0.5,
  };
}

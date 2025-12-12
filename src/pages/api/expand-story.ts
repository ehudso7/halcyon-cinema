import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { requireAuth, checkRateLimit } from '@/utils/api-auth';

interface StoryExpansionRequest {
  prompt: string;
  genre?: string;
  mood?: string;
  sceneCount?: number;
}

interface GeneratedCharacter {
  name: string;
  role: string;
  description: string;
  archetype: string;
  emotionalArc: string;
  traits: string[];
  visualDescription: string;
  voiceStyle: string;
}

interface GeneratedScene {
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

interface GeneratedLore {
  type: 'location' | 'event' | 'system' | 'object' | 'concept';
  name: string;
  summary: string;
  description: string;
  visualMotifs: string[];
}

interface VisualStyleGuide {
  primaryStyle: string;
  colorPalette: string[];
  lightingApproach: string;
  cameraStyle: string;
  inspirationFilms: string[];
  toneKeywords: string[];
  visualMotifs: string[];
}

interface StoryExpansionResponse {
  success: boolean;
  projectName?: string;
  projectDescription?: string;
  logline?: string;
  tagline?: string;
  directorsConcept?: string;
  genre?: string;
  tone?: string;
  visualStyle?: string;
  styleGuide?: VisualStyleGuide;
  characters?: GeneratedCharacter[];
  scenes?: GeneratedScene[];
  lore?: GeneratedLore[];
  qualityMetrics?: {
    narrativeCoherence: number;
    characterDepth: number;
    worldBuilding: number;
    visualClarity: number;
    overallScore: number;
  };
  error?: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AI Story Expansion API - Professional Cinematic Package Generator
 *
 * Takes a simple prompt and expands it into a complete, studio-grade cinematic project:
 * - Logline and tagline
 * - Director's concept statement
 * - Screenplay-formatted scenes
 * - Deep character profiles with arcs
 * - Rich world lore
 * - Visual style guide with moodboard elements
 * - Quality metrics
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StoryExpansionResponse>
) {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  if (!checkRateLimit(`expand-story:${userId}`, 10, 3600000)) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. You can generate up to 10 projects per hour.',
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`,
    });
  }

  const { prompt, genre, mood, sceneCount = 5 }: StoryExpansionRequest = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Prompt is required',
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'AI features are not configured. Please add OPENAI_API_KEY.',
    });
  }

  const clampedSceneCount = Math.min(Math.max(sceneCount, 3), 10);
  const dynamicMaxTokens = Math.min(4000 + (clampedSceneCount - 3) * 400, 8000);

  try {
    const systemPrompt = `You are an elite screenwriter, director, and world-builder with decades of experience crafting award-winning cinematic narratives. Your writing rivals the best of A24, Christopher Nolan, and Denis Villeneuve.

Create a COMPLETE, PROFESSIONAL cinematic project from the user's story seed. Your output must be studio-ready quality.

REQUIREMENTS:

1. PROJECT IDENTITY
   - Create a compelling, marketable title
   - Write a punchy logline (1 sentence, under 30 words)
   - Craft a memorable tagline (short, evocative phrase for posters)
   - Write a Director's Concept (2-3 sentences capturing vision, tone, themes)

2. ${clampedSceneCount} SCREENPLAY-FORMAT SCENES
   Each scene must include:
   - Scene number and title
   - Proper slugline (INT./EXT. LOCATION - TIME)
   - Setting description
   - Detailed visual prompt for AI image generation (80-120 words)
   - Screenplay excerpt (action lines + minimal dialogue, 50-100 words)
   - Shot type, mood, lighting
   - Key actions and emotional beat
   - Characters present

3. 3-4 DEEP CHARACTER PROFILES
   Each character needs:
   - Name and role in story
   - Archetype (e.g., "The Reluctant Hero", "The Trickster Mentor")
   - Personality description (2-3 sentences)
   - Emotional arc across the story
   - 3-5 defining traits
   - Detailed visual description for consistency
   - Voice/dialogue style notes

4. 3-4 WORLD LORE ENTRIES
   Types: location, event, system, object, or concept
   Each needs:
   - Name and type
   - One-sentence summary
   - Rich 2-3 sentence description
   - Visual motifs associated with it

5. VISUAL STYLE GUIDE
   - Primary visual style (e.g., "Neo-Noir Realism", "Dreamlike Fantasy")
   - Color palette (5-7 specific colors/tones)
   - Lighting approach
   - Camera style preferences
   - 3-5 inspiration films
   - Tone keywords
   - Recurring visual motifs

QUALITY STANDARDS (Apply these rigorously):
- Every scene must advance plot or reveal character
- Dialogue must be naturalistic and character-specific
- Descriptions must be visceral and sensory
- Avoid clichés and generic phrasing
- Each character must have a distinct voice
- World details must feel lived-in and consistent
- Visual prompts must be specific enough for consistent AI generation

${genre ? `GENRE: ${genre}` : ''}
${mood ? `MOOD/TONE: ${mood}` : ''}

Respond ONLY with valid JSON matching this structure:
{
  "projectName": "string",
  "projectDescription": "string (2-3 sentences)",
  "logline": "string (1 sentence, under 30 words)",
  "tagline": "string (short evocative phrase)",
  "directorsConcept": "string (2-3 sentences on vision/tone/themes)",
  "genre": "string",
  "tone": "string",
  "visualStyle": "string",
  "styleGuide": {
    "primaryStyle": "string",
    "colorPalette": ["color1", "color2", "..."],
    "lightingApproach": "string",
    "cameraStyle": "string",
    "inspirationFilms": ["film1", "film2", "..."],
    "toneKeywords": ["keyword1", "keyword2", "..."],
    "visualMotifs": ["motif1", "motif2", "..."]
  },
  "characters": [
    {
      "name": "string",
      "role": "string (e.g., Protagonist, Antagonist, Mentor)",
      "archetype": "string",
      "description": "string (2-3 sentences)",
      "emotionalArc": "string (character's journey)",
      "traits": ["trait1", "trait2", "..."],
      "visualDescription": "string (detailed appearance)",
      "voiceStyle": "string (how they speak)"
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "string",
      "slugline": "INT./EXT. LOCATION - TIME",
      "setting": "string (brief setting description)",
      "timeOfDay": "string",
      "prompt": "string (80-120 word visual description for AI image generation)",
      "screenplay": "string (action lines and dialogue excerpt)",
      "shotType": "string",
      "mood": "string",
      "lighting": "string",
      "characters": ["character names"],
      "keyActions": ["action1", "action2"],
      "emotionalBeat": "string (what this scene makes audience feel)"
    }
  ],
  "lore": [
    {
      "type": "location|event|system|object|concept",
      "name": "string",
      "summary": "string (1 sentence)",
      "description": "string (2-3 sentences)",
      "visualMotifs": ["motif1", "motif2"]
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt.trim() },
      ],
      max_tokens: dynamicMaxTokens,
      temperature: 0.85,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json({
        success: false,
        error: 'No response from AI',
      });
    }

    const parsed = JSON.parse(content);

    // Validate required fields
    if (!parsed.projectName || !parsed.scenes || !Array.isArray(parsed.scenes)) {
      return res.status(500).json({
        success: false,
        error: 'Invalid response structure from AI',
      });
    }

    // Validate and filter scenes
    const validScenes = parsed.scenes.filter(
      (scene: Record<string, unknown>) =>
        scene && typeof scene.prompt === 'string' && scene.prompt.trim().length > 0
    );

    if (validScenes.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'AI generated no valid scenes',
      });
    }

    // Validate characters
    const validCharacters = (parsed.characters || []).filter(
      (char: Record<string, unknown>) =>
        char && typeof char.name === 'string' && char.name.trim().length > 0
    );

    // Validate lore
    const validLore = (parsed.lore || []).filter(
      (lore: Record<string, unknown>) =>
        lore && typeof lore.name === 'string' && lore.name.trim().length > 0
    );

    // Calculate quality metrics based on content completeness
    const qualityMetrics = calculateQualityMetrics(parsed, validScenes, validCharacters, validLore);

    return res.status(200).json({
      success: true,
      projectName: parsed.projectName,
      projectDescription: parsed.projectDescription,
      logline: parsed.logline,
      tagline: parsed.tagline,
      directorsConcept: parsed.directorsConcept,
      genre: parsed.genre || genre,
      tone: parsed.tone || mood,
      visualStyle: parsed.visualStyle,
      styleGuide: parsed.styleGuide,
      characters: validCharacters,
      scenes: validScenes,
      lore: validLore,
      qualityMetrics,
    });
  } catch (error) {
    console.error('[expand-story] Error:', error);

    if (error instanceof OpenAI.APIError) {
      return res.status(502).json({
        success: false,
        error: `AI service error: ${error.message}`,
      });
    }

    if (error instanceof SyntaxError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to parse AI response',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to expand story',
    });
  }
}

/**
 * Calculate quality metrics based on content completeness and depth
 */
function calculateQualityMetrics(
  parsed: Record<string, unknown>,
  scenes: unknown[],
  characters: unknown[],
  lore: unknown[]
): { narrativeCoherence: number; characterDepth: number; worldBuilding: number; visualClarity: number; overallScore: number } {
  let narrativeCoherence = 50;
  let characterDepth = 50;
  let worldBuilding = 50;
  let visualClarity = 50;

  // Narrative coherence: logline, tagline, director's concept, scene progression
  if (parsed.logline && typeof parsed.logline === 'string' && parsed.logline.length > 10) narrativeCoherence += 15;
  if (parsed.tagline && typeof parsed.tagline === 'string') narrativeCoherence += 10;
  if (parsed.directorsConcept && typeof parsed.directorsConcept === 'string' && parsed.directorsConcept.length > 50) narrativeCoherence += 15;
  if (scenes.length >= 5) narrativeCoherence += 10;

  // Character depth: number of characters, traits, arcs
  if (characters.length >= 3) characterDepth += 15;
  characters.forEach((char) => {
    const c = char as Record<string, unknown>;
    if (c.emotionalArc && typeof c.emotionalArc === 'string' && c.emotionalArc.length > 20) characterDepth += 5;
    if (Array.isArray(c.traits) && c.traits.length >= 3) characterDepth += 5;
    if (c.archetype && typeof c.archetype === 'string') characterDepth += 3;
  });
  characterDepth = Math.min(characterDepth, 100);

  // World building: lore entries, visual motifs
  if (lore.length >= 3) worldBuilding += 20;
  lore.forEach((l) => {
    const entry = l as Record<string, unknown>;
    if (entry.description && typeof entry.description === 'string' && entry.description.length > 50) worldBuilding += 5;
    if (Array.isArray(entry.visualMotifs) && entry.visualMotifs.length >= 2) worldBuilding += 5;
  });
  worldBuilding = Math.min(worldBuilding, 100);

  // Visual clarity: style guide completeness
  const styleGuide = parsed.styleGuide as Record<string, unknown> | undefined;
  if (styleGuide) {
    if (styleGuide.primaryStyle) visualClarity += 10;
    if (Array.isArray(styleGuide.colorPalette) && styleGuide.colorPalette.length >= 5) visualClarity += 10;
    if (styleGuide.lightingApproach) visualClarity += 10;
    if (Array.isArray(styleGuide.inspirationFilms) && styleGuide.inspirationFilms.length >= 3) visualClarity += 10;
    if (Array.isArray(styleGuide.visualMotifs) && styleGuide.visualMotifs.length >= 3) visualClarity += 10;
  }

  const overallScore = Math.round((narrativeCoherence + characterDepth + worldBuilding + visualClarity) / 4);

  return {
    narrativeCoherence: Math.min(narrativeCoherence, 100),
    characterDepth: Math.min(characterDepth, 100),
    worldBuilding: Math.min(worldBuilding, 100),
    visualClarity: Math.min(visualClarity, 100),
    overallScore,
  };
}

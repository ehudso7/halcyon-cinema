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
  description: string;
  traits: string[];
  visualDescription: string;
}

interface GeneratedScene {
  title: string;
  prompt: string;
  shotType: string;
  mood: string;
  lighting: string;
  characters: string[];
}

interface GeneratedLore {
  type: 'location' | 'event' | 'system';
  name: string;
  summary: string;
  description: string;
}

interface StoryExpansionResponse {
  success: boolean;
  projectName?: string;
  projectDescription?: string;
  visualStyle?: string;
  characters?: GeneratedCharacter[];
  scenes?: GeneratedScene[];
  lore?: GeneratedLore[];
  error?: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AI Story Expansion API
 * Takes a simple prompt and expands it into a complete cinematic project with:
 * - Project name and description
 * - Multiple scenes with detailed prompts
 * - Characters with descriptions and traits
 * - World lore entries
 * - Consistent visual style
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StoryExpansionResponse>
) {
  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  // Rate limiting: 10 story expansions per hour per user (expensive AI operation)
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

  // Dynamic max tokens based on scene count (base 2500 + 200 per extra scene above 3)
  const dynamicMaxTokens = Math.min(2500 + (clampedSceneCount - 3) * 200, 4000);

  try {
    const systemPrompt = `You are an expert cinematic storyteller and storyboard artist. Your task is to expand a simple story idea into a complete cinematic project.

Given a brief prompt, you will create:
1. A compelling project name and description
2. ${clampedSceneCount} detailed scene descriptions that tell a cohesive visual story
3. 2-4 main characters with rich descriptions
4. 2-3 world-building lore entries (locations, events, or systems)
5. A consistent visual style recommendation

IMPORTANT GUIDELINES:
- Each scene should be a distinct visual moment that could be a cinematic still
- Scenes should progress logically to tell a story arc
- Characters should be visually distinct and memorable
- Scene prompts should be detailed enough for AI image generation (50-100 words)
- All content must be safe for image generation (no violence, gore, or explicit content)
${genre ? `- Genre: ${genre}` : ''}
${mood ? `- Overall mood: ${mood}` : ''}

Respond ONLY with valid JSON in this exact format:
{
  "projectName": "string",
  "projectDescription": "string (2-3 sentences)",
  "visualStyle": "string (e.g., 'Cinematic Realism', 'Film Noir', 'Anime', 'Fantasy Art')",
  "characters": [
    {
      "name": "string",
      "description": "string (2-3 sentences about personality and role)",
      "traits": ["trait1", "trait2", "trait3"],
      "visualDescription": "string (detailed appearance for image generation)"
    }
  ],
  "scenes": [
    {
      "title": "string (short scene title)",
      "prompt": "string (detailed scene description for image generation, 50-100 words)",
      "shotType": "string (Wide Shot, Medium Shot, Close-up, Establishing Shot, etc.)",
      "mood": "string (Epic, Mysterious, Romantic, Tense, Peaceful, etc.)",
      "lighting": "string (Natural, Golden Hour, Dramatic, Soft, Neon, etc.)",
      "characters": ["character names appearing in this scene"]
    }
  ],
  "lore": [
    {
      "type": "location | event | system",
      "name": "string",
      "summary": "string (1 sentence)",
      "description": "string (2-3 sentences)"
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
      temperature: 0.8,
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

    // Validate scene structure - ensure each scene has required prompt field
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

    // Validate characters if present
    const validCharacters = (parsed.characters || []).filter(
      (char: Record<string, unknown>) =>
        char && typeof char.name === 'string' && char.name.trim().length > 0
    );

    // Validate lore if present
    const validLore = (parsed.lore || []).filter(
      (lore: Record<string, unknown>) =>
        lore && typeof lore.name === 'string' && lore.name.trim().length > 0
    );

    return res.status(200).json({
      success: true,
      projectName: parsed.projectName,
      projectDescription: parsed.projectDescription,
      visualStyle: parsed.visualStyle,
      characters: validCharacters,
      scenes: validScenes,
      lore: validLore,
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

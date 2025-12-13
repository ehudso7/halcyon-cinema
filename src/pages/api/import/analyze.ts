import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import OpenAI from 'openai';
import { ApiError } from '@/types';

// Increase body size limit for large content
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

interface ExtractedCharacter {
  name: string;
  description: string;
  traits: string[];
  role?: string;
}

interface ExtractedLocation {
  name: string;
  description: string;
}

interface ExtractedLore {
  name: string;
  description: string;
  type: 'event' | 'system' | 'object' | 'concept';
}

interface ExtractedScene {
  title: string;
  description: string;
  visualPrompt: string;
}

interface AnalysisResponse {
  success: boolean;
  summary?: string;
  characters?: ExtractedCharacter[];
  locations?: ExtractedLocation[];
  lore?: ExtractedLore[];
  scenes?: ExtractedScene[];
  detectedGenre?: string;
  detectedTone?: string;
  error?: string;
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalysisResponse | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!openai) {
    return res.status(503).json({ error: 'AI analysis is not configured' });
  }

  const { content } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Content is required' });
  }

  if (content.trim().length < 100) {
    return res.status(400).json({ error: 'Content must be at least 100 characters' });
  }

  // Limit content length to prevent excessive API costs
  const maxLength = 50000;
  const truncatedContent = content.length > maxLength
    ? content.substring(0, maxLength) + '\n\n[Content truncated...]'
    : content;

  try {
    const systemPrompt = `You are an expert story analyst and creative director for a cinematic production studio. Your job is to analyze written content (stories, scripts, novels, outlines) and extract structured data for creating a visual storyboard project.

Analyze the provided content and extract:

1. **Summary**: A 2-3 sentence summary of the story/content
2. **Characters**: All named characters with descriptions and personality traits
3. **Locations**: All named places/settings
4. **Lore/World-Building**: Important world elements like:
   - Systems (political, magical, technological)
   - Events (historical, prophesied)
   - Objects (artifacts, important items)
   - Concepts (rules of the world, philosophies)
5. **Scenes**: Key visual moments that would make compelling storyboard panels
6. **Genre & Tone**: Detected genre and emotional tone

Return your analysis as JSON with this exact structure:
{
  "summary": "Brief 2-3 sentence summary of the content",
  "characters": [
    {
      "name": "Character Name",
      "description": "Physical appearance, background, and role in the story",
      "traits": ["trait1", "trait2", "trait3"],
      "role": "protagonist/antagonist/supporting/minor"
    }
  ],
  "locations": [
    {
      "name": "Location Name",
      "description": "Visual description of the place, atmosphere, and significance"
    }
  ],
  "lore": [
    {
      "name": "Element Name",
      "description": "Detailed description of the world-building element",
      "type": "system|event|object|concept"
    }
  ],
  "scenes": [
    {
      "title": "Scene Title",
      "description": "What happens in this scene and why it's important",
      "visualPrompt": "Detailed image generation prompt for this scene - include setting, lighting, mood, characters present, action, and cinematic style"
    }
  ],
  "detectedGenre": "primary genre (sci-fi, fantasy, thriller, drama, etc.)",
  "detectedTone": "primary tone (dark, epic, mysterious, romantic, etc.)"
}

Guidelines:
- Extract ALL named characters, even minor ones
- For scenes, focus on visually compelling moments - action, emotion, reveals, establishing shots
- Visual prompts should be detailed enough to generate a compelling image (100+ words)
- Include 6-10 scenes for longer content, 3-6 for shorter content
- Be thorough with world-building elements - these add depth to cinematic projects
- If content is a script/screenplay, extract scenes based on major beats
- If content is prose, identify key moments that would translate well to visual media`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Analyze this content and extract all characters, locations, world lore, and key scenes:\n\n---\n\n${truncatedContent}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 8000,
      temperature: 0.7,
    });

    const analysisText = completion.choices[0].message.content || '{}';
    let analysis;

    try {
      analysis = JSON.parse(analysisText);
    } catch {
      console.error('[import/analyze] Failed to parse JSON response:', analysisText.substring(0, 500));
      return res.status(500).json({
        success: false,
        error: 'Failed to parse analysis results',
      });
    }

    // Validate and sanitize the response
    const response: AnalysisResponse = {
      success: true,
      summary: analysis.summary || '',
      characters: Array.isArray(analysis.characters) ? analysis.characters.map((c: Partial<ExtractedCharacter>) => ({
        name: c.name || 'Unknown Character',
        description: c.description || '',
        traits: Array.isArray(c.traits) ? c.traits : [],
        role: c.role || 'supporting',
      })) : [],
      locations: Array.isArray(analysis.locations) ? analysis.locations.map((l: Partial<ExtractedLocation>) => ({
        name: l.name || 'Unknown Location',
        description: l.description || '',
      })) : [],
      lore: Array.isArray(analysis.lore) ? analysis.lore.map((l: Partial<ExtractedLore>) => ({
        name: l.name || 'Unknown Element',
        description: l.description || '',
        type: ['system', 'event', 'object', 'concept'].includes(l.type || '') ? l.type : 'concept',
      })) : [],
      scenes: Array.isArray(analysis.scenes) ? analysis.scenes.map((s: Partial<ExtractedScene>) => ({
        title: s.title || 'Untitled Scene',
        description: s.description || '',
        visualPrompt: s.visualPrompt || s.description || '',
      })) : [],
      detectedGenre: analysis.detectedGenre || 'drama',
      detectedTone: analysis.detectedTone || 'dramatic',
    };

    // Log extraction stats
    console.log(`[import/analyze] Extracted: ${response.characters?.length || 0} characters, ${response.locations?.length || 0} locations, ${response.lore?.length || 0} lore, ${response.scenes?.length || 0} scenes`);

    return res.status(200).json(response);
  } catch (error) {
    console.error('[import/analyze] Error:', error);

    // Check for specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Please try again in a few moments.',
        });
      }
      if (error.status === 503) {
        return res.status(503).json({
          success: false,
          error: 'AI service temporarily unavailable. Please try again later.',
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze content',
    });
  }
}

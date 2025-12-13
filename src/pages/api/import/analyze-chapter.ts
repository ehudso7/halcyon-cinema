import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import OpenAI from 'openai';

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
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  firstAppearance: boolean;
  arcDevelopment?: string;
}

interface ExtractedLocation {
  name: string;
  description: string;
  significance: string;
  firstAppearance: boolean;
}

interface ExtractedScene {
  title: string;
  description: string;
  visualPrompt: string;
  sceneType: 'opening' | 'action' | 'dialogue' | 'revelation' | 'climax' | 'resolution' | 'transition';
  emotionalBeat: string;
  characters: string[];
  location: string;
}

interface ExtractedLore {
  name: string;
  description: string;
  type: 'event' | 'system' | 'object' | 'concept';
}

interface PlotPoint {
  type: 'setup' | 'conflict' | 'complication' | 'crisis' | 'climax' | 'resolution' | 'hook';
  description: string;
  significance: string;
}

interface ChapterAnalysis {
  success: boolean;
  chapterIndex: number;
  summary?: string;
  characters?: ExtractedCharacter[];
  locations?: ExtractedLocation[];
  lore?: ExtractedLore[];
  scenes?: ExtractedScene[];
  plotPoints?: PlotPoint[];
  emotionalArc?: string;
  pacing?: 'slow' | 'moderate' | 'fast';
  error?: string;
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChapterAnalysis>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, chapterIndex: -1, error: `Method ${req.method} not allowed` });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ success: false, chapterIndex: -1, error: 'Unauthorized' });
  }

  if (!openai) {
    return res.status(503).json({ success: false, chapterIndex: -1, error: 'AI analysis not configured' });
  }

  const {
    content,
    chapterIndex,
    chapterTitle,
    previousCharacters = [],
    previousLocations = [],
    novelContext = '',
  } = req.body;

  // Validate chapterIndex
  const parsedChapterIndex = typeof chapterIndex === 'number' ? chapterIndex : parseInt(chapterIndex, 10);
  if (isNaN(parsedChapterIndex) || parsedChapterIndex < 0) {
    return res.status(400).json({ success: false, chapterIndex: -1, error: 'Valid chapterIndex is required' });
  }

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ success: false, chapterIndex: parsedChapterIndex, error: 'Content is required' });
  }

  try {
    // Truncate content if too long
    const maxLength = 30000;
    const truncatedContent = content.length > maxLength
      ? content.substring(0, maxLength) + '\n\n[Chapter content truncated...]'
      : content;

    const previousCharacterNames = previousCharacters.map((c: { name: string }) => c.name).join(', ');
    const previousLocationNames = previousLocations.map((l: { name: string }) => l.name).join(', ');

    const systemPrompt = `You are an expert literary analyst and screenplay consultant. Analyze this chapter and extract structured data for a visual storyboard project.

${novelContext ? `NOVEL CONTEXT:\n${novelContext}\n\n` : ''}
${previousCharacterNames ? `KNOWN CHARACTERS FROM PREVIOUS CHAPTERS: ${previousCharacterNames}\n` : ''}
${previousLocationNames ? `KNOWN LOCATIONS FROM PREVIOUS CHAPTERS: ${previousLocationNames}\n` : ''}

Analyze this chapter (${chapterTitle || `Chapter ${parsedChapterIndex + 1}`}) and extract:

1. **Summary**: 2-3 sentence chapter summary
2. **Characters**: All characters appearing in this chapter
   - Mark "firstAppearance: true" only for NEW characters not in the known list
   - Include character development/arc changes in this chapter
3. **Locations**: Settings in this chapter
   - Mark "firstAppearance: true" for new locations
4. **Scenes**: 3-6 key visual moments ideal for storyboarding
   - Each scene should have a detailed visualPrompt (100+ words) for image generation
5. **Plot Points**: Major story beats in this chapter
6. **Lore**: World-building elements (systems, events, objects, concepts)
7. **Emotional Arc**: The emotional journey of this chapter
8. **Pacing**: slow/moderate/fast

Return JSON:
{
  "summary": "Chapter summary",
  "characters": [
    {
      "name": "Character Name",
      "description": "Physical and personality description",
      "traits": ["trait1", "trait2"],
      "role": "protagonist|antagonist|supporting|minor",
      "firstAppearance": boolean,
      "arcDevelopment": "How the character develops in this chapter (if any)"
    }
  ],
  "locations": [
    {
      "name": "Location Name",
      "description": "Visual description of the place",
      "significance": "Why this location matters",
      "firstAppearance": boolean
    }
  ],
  "scenes": [
    {
      "title": "Scene Title",
      "description": "What happens and why it matters",
      "visualPrompt": "Detailed image generation prompt - setting, lighting, mood, characters, action, cinematic style (100+ words)",
      "sceneType": "opening|action|dialogue|revelation|climax|resolution|transition",
      "emotionalBeat": "The emotion this scene conveys",
      "characters": ["Character names present"],
      "location": "Location name"
    }
  ],
  "plotPoints": [
    {
      "type": "setup|conflict|complication|crisis|climax|resolution|hook",
      "description": "What happens",
      "significance": "Why it matters to the story"
    }
  ],
  "lore": [
    {
      "name": "Element name",
      "description": "Description",
      "type": "event|system|object|concept"
    }
  ],
  "emotionalArc": "Description of the chapter's emotional progression",
  "pacing": "slow|moderate|fast"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this chapter:\n\n---\n\n${truncatedContent}` },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 6000,
      temperature: 0.7,
    });

    const analysisText = completion.choices[0].message.content || '{}';
    let analysis;

    try {
      analysis = JSON.parse(analysisText);
    } catch {
      console.error('[analyze-chapter] Failed to parse JSON:', analysisText.substring(0, 500));
      return res.status(500).json({
        success: false,
        chapterIndex: parsedChapterIndex,
        error: 'Failed to parse analysis results',
      });
    }

    // Validate and sanitize response
    const response: ChapterAnalysis = {
      success: true,
      chapterIndex: parsedChapterIndex,
      summary: analysis.summary || '',
      characters: Array.isArray(analysis.characters) ? analysis.characters.map((c: Partial<ExtractedCharacter>) => ({
        name: c.name || 'Unknown',
        description: c.description || '',
        traits: Array.isArray(c.traits) ? c.traits : [],
        role: ['protagonist', 'antagonist', 'supporting', 'minor'].includes(c.role || '') ? c.role : 'supporting',
        firstAppearance: c.firstAppearance ?? true,
        arcDevelopment: c.arcDevelopment || '',
      })) : [],
      locations: Array.isArray(analysis.locations) ? analysis.locations.map((l: Partial<ExtractedLocation>) => ({
        name: l.name || 'Unknown',
        description: l.description || '',
        significance: l.significance || '',
        firstAppearance: l.firstAppearance ?? true,
      })) : [],
      scenes: Array.isArray(analysis.scenes) ? analysis.scenes.map((s: Partial<ExtractedScene>) => ({
        title: s.title || 'Untitled Scene',
        description: s.description || '',
        visualPrompt: s.visualPrompt || s.description || '',
        sceneType: ['opening', 'action', 'dialogue', 'revelation', 'climax', 'resolution', 'transition'].includes(s.sceneType || '') ? s.sceneType : 'action',
        emotionalBeat: s.emotionalBeat || '',
        characters: Array.isArray(s.characters) ? s.characters : [],
        location: s.location || '',
      })) : [],
      plotPoints: Array.isArray(analysis.plotPoints) ? analysis.plotPoints.map((p: Partial<PlotPoint>) => ({
        type: ['setup', 'conflict', 'complication', 'crisis', 'climax', 'resolution', 'hook'].includes(p.type || '') ? p.type : 'conflict',
        description: p.description || '',
        significance: p.significance || '',
      })) : [],
      lore: Array.isArray(analysis.lore) ? analysis.lore.map((l: Partial<ExtractedLore>) => ({
        name: l.name || 'Unknown',
        description: l.description || '',
        type: ['event', 'system', 'object', 'concept'].includes(l.type || '') ? l.type : 'concept',
      })) : [],
      emotionalArc: analysis.emotionalArc || '',
      pacing: ['slow', 'moderate', 'fast'].includes(analysis.pacing) ? analysis.pacing : 'moderate',
    };

    console.log(`[analyze-chapter] Chapter ${parsedChapterIndex}: ${response.characters?.length || 0} chars, ${response.scenes?.length || 0} scenes`);

    return res.status(200).json(response);
  } catch (error) {
    console.error('[analyze-chapter] Error:', error);

    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return res.status(429).json({
          success: false,
          chapterIndex: parsedChapterIndex,
          error: 'Rate limit exceeded. Please wait a moment.',
        });
      }
    }

    return res.status(500).json({
      success: false,
      chapterIndex: parsedChapterIndex,
      error: error instanceof Error ? error.message : 'Failed to analyze chapter',
    });
  }
}

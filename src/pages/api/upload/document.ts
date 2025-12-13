import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import OpenAI from 'openai';
import { ApiError } from '@/types';

// Increase body size limit for document uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

interface DocumentAnalysisResponse {
  success: boolean;
  content?: string;
  summary?: string;
  suggestedScenes?: Array<{
    title: string;
    description: string;
    visualPrompt: string;
  }>;
  characters?: Array<{
    name: string;
    description: string;
    traits: string[];
  }>;
  error?: string;
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DocumentAnalysisResponse | ApiError>
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

  const { content, filename, analyzeForScenes } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Document content is required' });
  }

  // Limit content length to prevent excessive API costs
  const maxLength = 50000; // ~50k characters
  const truncatedContent = content.length > maxLength
    ? content.substring(0, maxLength) + '\n\n[Content truncated...]'
    : content;

  try {
    if (analyzeForScenes) {
      // Analyze document and generate scene suggestions
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a creative director analyzing documents to create visual storyboards.
Extract key scenes, characters, and visual moments from the provided content.
Return your analysis as JSON with this structure:
{
  "summary": "Brief summary of the document",
  "suggestedScenes": [
    {
      "title": "Scene title",
      "description": "What happens in this scene",
      "visualPrompt": "Detailed prompt for generating an image of this scene"
    }
  ],
  "characters": [
    {
      "name": "Character name",
      "description": "Physical description and role",
      "traits": ["trait1", "trait2"]
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Analyze this document and extract visual scenes and characters:\n\n${truncatedContent}`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      });

      const analysis = JSON.parse(completion.choices[0].message.content || '{}');

      return res.status(200).json({
        success: true,
        content: truncatedContent,
        summary: analysis.summary,
        suggestedScenes: analysis.suggestedScenes || [],
        characters: analysis.characters || [],
      });
    }

    // Simple content extraction without AI analysis
    return res.status(200).json({
      success: true,
      content: truncatedContent,
      summary: truncatedContent.substring(0, 500) + (truncatedContent.length > 500 ? '...' : ''),
    });
  } catch (error) {
    console.error('[upload/document] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze document',
    });
  }
}

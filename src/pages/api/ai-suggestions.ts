import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { AISuggestion, ApiError } from '@/types';
import { requireAuth, checkRateLimit } from '@/utils/api-auth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ suggestions: AISuggestion[] } | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  // Rate limiting: 30 suggestions per minute per user
  if (!checkRateLimit(`suggestions:${userId}`, 30, 60000)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    // Return fallback suggestions if no API key
    return res.status(200).json({
      suggestions: getFallbackSuggestions(prompt),
    });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a cinematic AI assistant helping to enhance scene prompts. Given a scene description, suggest 3-5 creative enhancements. Return JSON array with objects containing: id (unique string), type (one of: lighting, mood, composition, story, style), title (short catchy title), description (1 sentence), promptAddition (specific text to add to prompt).`,
        },
        {
          role: 'user',
          content: `Analyze this scene and suggest enhancements: "${prompt}"`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    return res.status(200).json({ suggestions });
  } catch (error) {
    console.error('AI suggestions error:', error);
    // Return fallback suggestions on error
    return res.status(200).json({
      suggestions: getFallbackSuggestions(prompt),
    });
  }
}

function getFallbackSuggestions(prompt: string): AISuggestion[] {
  const lowerPrompt = prompt.toLowerCase();

  const suggestions: AISuggestion[] = [];

  // Context-aware fallback suggestions
  if (lowerPrompt.includes('night') || lowerPrompt.includes('dark')) {
    suggestions.push({
      id: 'custom-1',
      type: 'lighting',
      title: 'Moonlit Atmosphere',
      description: 'Add ethereal moonlight to enhance the night setting',
      promptAddition: 'soft moonlight casting silver highlights, deep shadows',
    });
  }

  if (lowerPrompt.includes('character') || lowerPrompt.includes('person') || lowerPrompt.includes('figure')) {
    suggestions.push({
      id: 'custom-2',
      type: 'composition',
      title: 'Character Focus',
      description: 'Draw attention to the main character',
      promptAddition: 'dramatic character lighting, shallow depth of field, hero framing',
    });
  }

  if (lowerPrompt.includes('battle') || lowerPrompt.includes('fight') || lowerPrompt.includes('war')) {
    suggestions.push({
      id: 'custom-3',
      type: 'mood',
      title: 'Epic Tension',
      description: 'Heighten the dramatic tension',
      promptAddition: 'epic battle atmosphere, dust particles, dramatic clouds, intense lighting',
    });
  }

  // Always include some general suggestions
  suggestions.push(
    {
      id: 'custom-4',
      type: 'style',
      title: 'Cinematic Grade',
      description: 'Add professional color grading',
      promptAddition: 'cinematic color grading, film grain, anamorphic lens flare',
    },
    {
      id: 'custom-5',
      type: 'lighting',
      title: 'Volumetric Light',
      description: 'Add atmospheric light rays',
      promptAddition: 'volumetric god rays, atmospheric haze, light beams',
    }
  );

  return suggestions.slice(0, 5);
}

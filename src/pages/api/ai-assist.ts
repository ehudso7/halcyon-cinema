import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { checkRateLimit } from '@/utils/api-auth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get client IP for rate limiting
function getClientIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  return req.headers['x-real-ip'] as string || req.socket.remoteAddress || 'unknown';
}

interface Suggestion {
  id: string;
  text: string;
  type: 'replace' | 'append' | 'enhance';
}

interface AIAssistRequest {
  fieldName: string;
  currentValue: string;
  context?: string;
}

interface AIAssistResponse {
  suggestions: Suggestion[];
}

/**
 * AI Assist API endpoint that generates contextual suggestions for any field.
 * Provides intelligent assistance for character descriptions, scene prompts,
 * titles, and other creative content.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AIAssistResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Rate limiting: 20 suggestions per IP per minute
  const clientIP = getClientIP(req);
  if (!checkRateLimit(`ai-assist:${clientIP}`, 20, 60000)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait before requesting more suggestions.' });
  }

  const { fieldName, currentValue, context } = req.body as AIAssistRequest;

  if (!fieldName) {
    return res.status(400).json({ error: 'Field name is required' });
  }

  try {
    const systemPrompt = buildSystemPrompt(fieldName);
    const userPrompt = buildUserPrompt(fieldName, currentValue, context);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    const suggestions: Suggestion[] = (parsed.suggestions || []).slice(0, 5).map(
      (s: { text: string; type?: string }, idx: number) => ({
        id: `suggestion-${idx}`,
        text: s.text,
        type: validateSuggestionType(s.type),
      })
    );

    return res.status(200).json({ suggestions });
  } catch (error) {
    console.error('[ai-assist] Error generating suggestions:', error);
    return res.status(500).json({ error: 'Failed to generate suggestions' });
  }
}

function validateSuggestionType(type?: string): 'replace' | 'append' | 'enhance' {
  if (type === 'append' || type === 'enhance') return type;
  return 'replace';
}

function buildSystemPrompt(fieldName: string): string {
  const fieldType = categorizeField(fieldName);

  const basePrompt = `You are an AI creative assistant for a cinematic visualization platform.
Your task is to provide helpful, creative suggestions for the user's input field.
Always respond with valid JSON in this format:
{
  "suggestions": [
    { "text": "suggestion text", "type": "replace|append|enhance" }
  ]
}

Provide 3-5 suggestions that are:
- Contextually appropriate
- Creative and engaging
- Varied in approach (some replace, some enhance)
- Professional quality`;

  switch (fieldType) {
    case 'character':
      return `${basePrompt}

For character-related fields:
- Focus on vivid, visual descriptions
- Include personality traits and quirks
- Consider role in the story
- Make characters memorable and distinct`;

    case 'scene':
      return `${basePrompt}

For scene-related fields:
- Create cinematic, visual descriptions
- Include atmosphere, lighting, mood
- Consider camera angles and composition
- Make scenes emotionally impactful`;

    case 'location':
      return `${basePrompt}

For location-related fields:
- Describe sensory details (sights, sounds, smells)
- Include atmospheric elements
- Consider time of day and weather
- Make places feel lived-in and real`;

    case 'title':
      return `${basePrompt}

For title-related fields:
- Create compelling, memorable titles
- Consider genre and tone
- Make titles evocative and intriguing
- Balance clarity with creativity`;

    default:
      return basePrompt;
  }
}

function buildUserPrompt(fieldName: string, currentValue: string, context?: string): string {
  let prompt = `Field: ${fieldName}\n`;

  if (currentValue && currentValue.trim()) {
    prompt += `Current value: "${currentValue}"\n`;
  } else {
    prompt += `Current value: (empty - user needs initial suggestions)\n`;
  }

  if (context && context.trim()) {
    prompt += `Additional context: ${context}\n`;
  }

  prompt += `\nProvide creative suggestions to help the user with this field.
If there's a current value, suggest improvements or alternatives.
If empty, suggest starting points based on the field type and context.`;

  return prompt;
}

function categorizeField(fieldName: string): 'character' | 'scene' | 'location' | 'title' | 'general' {
  const name = fieldName.toLowerCase();

  if (name.includes('character') || name.includes('person') || name.includes('trait')) {
    return 'character';
  }
  if (name.includes('scene') || name.includes('prompt') || name.includes('visual')) {
    return 'scene';
  }
  if (name.includes('location') || name.includes('place') || name.includes('setting')) {
    return 'location';
  }
  if (name.includes('title') || name.includes('name') || name.includes('heading')) {
    return 'title';
  }

  return 'general';
}

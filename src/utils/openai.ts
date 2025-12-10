import OpenAI from 'openai';
import { GenerateImageRequest, GenerateImageResponse } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Rewrite a prompt to be compatible with DALL-E's safety guidelines while
 * preserving the artistic and emotional intent. This transforms potentially
 * problematic descriptions (violence, injury, etc.) into artistically-framed
 * equivalents that convey the same visual story.
 */
export async function sanitizePromptForImageGeneration(prompt: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return prompt;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a cinematic prompt rewriter for AI image generation. Your job is to transform user prompts into versions that work with DALL-E's content policies while preserving the artistic vision.

REWRITING RULES:
1. Replace graphic violence with artistic equivalents:
   - "covered in blood" → "battle-worn with torn clothing"
   - "wounded/injured" → "exhausted, weathered"
   - "mauled/attacked" → "showing signs of an epic struggle"
   - "fighting/killed" → "standing victorious" or "in the aftermath of conflict"
   - "corpses/dead bodies" → "fallen warriors" or "battlefield at rest"

2. Focus on EMOTION and ATMOSPHERE over graphic details:
   - Describe the character's expression, posture, determination
   - Emphasize lighting, mood, and cinematic framing
   - Use metaphorical and poetic language

3. PRESERVE the core visual elements:
   - Character descriptions, clothing, setting
   - The emotional tone and narrative moment
   - Cinematic style and composition

4. Keep the prompt concise - under 200 words

Return ONLY the rewritten prompt, nothing else.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const rewrittenPrompt = response.choices[0]?.message?.content?.trim();

    if (rewrittenPrompt && rewrittenPrompt.length > 0) {
      console.log('[openai] Prompt sanitized for image generation');
      return rewrittenPrompt;
    }

    return prompt;
  } catch (error) {
    console.error('[openai] Prompt sanitization failed, using original:', error);
    return prompt;
  }
}

export async function generateImage(request: GenerateImageRequest): Promise<GenerateImageResponse> {
  const { prompt, size = '1024x1024', quality = 'standard', style = 'vivid' } = request;

  if (!process.env.OPENAI_API_KEY) {
    return {
      success: false,
      error: 'OpenAI API key is not configured',
    };
  }

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality,
      style,
    });

    const imageUrl = response.data?.[0]?.url;

    if (!imageUrl) {
      return {
        success: false,
        error: 'No image URL returned from API',
      };
    }

    return {
      success: true,
      imageUrl,
    };
  } catch (error) {
    console.error('OpenAI API error:', error);

    if (error instanceof OpenAI.APIError) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: 'Failed to generate image',
    };
  }
}

export function buildCinematicPrompt(
  basePrompt: string,
  options?: {
    shotType?: string;
    style?: string;
    lighting?: string;
    mood?: string;
  }
): string {
  const parts: string[] = [];

  if (options?.shotType) {
    parts.push(`${options.shotType} shot`);
  }

  parts.push(basePrompt);

  if (options?.style) {
    parts.push(`in ${options.style} style`);
  }

  if (options?.lighting) {
    parts.push(`with ${options.lighting} lighting`);
  }

  if (options?.mood) {
    parts.push(`${options.mood} mood`);
  }

  // Add cinematic quality keywords
  parts.push('cinematic quality, high detail, professional cinematography');

  return parts.join(', ');
}

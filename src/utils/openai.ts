import OpenAI from 'openai';
import { GenerateImageRequest, GenerateImageResponse } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

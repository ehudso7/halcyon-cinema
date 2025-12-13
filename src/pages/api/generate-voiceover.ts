import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, checkRateLimit } from '@/utils/api-auth';
import { deductCredits, getUserCredits, CreditError } from '@/utils/db';
import { getSupabaseServerClient, isSupabaseAdminConfigured } from '@/utils/supabase';
import { ApiError } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// OpenAI API for text-to-speech
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Credit cost for voiceover generation (per 1000 characters)
const VOICEOVER_CREDIT_COST_PER_1K = 2;
const MAX_TEXT_LENGTH = 4096;

// Timeout for OpenAI TTS API (30 seconds)
const OPENAI_TTS_TIMEOUT_MS = 30000;

// Available voices from OpenAI
const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
type Voice = (typeof VALID_VOICES)[number];

// Available models
const VALID_MODELS = ['tts-1', 'tts-1-hd'] as const;
type TTSModel = (typeof VALID_MODELS)[number];

interface GenerateVoiceoverResponse {
  success: boolean;
  audioUrl?: string;
  error?: string;
  creditsRemaining?: number;
  duration?: number;
  urlType?: 'permanent' | 'temporary';
}

const BUCKET_NAME = 'voiceovers';

/**
 * Sanitize a path component to prevent path traversal attacks.
 * Only allows alphanumeric characters, hyphens, and underscores.
 * Returns 'default' if sanitization results in an empty string.
 */
function sanitizePathComponent(input: string): string {
  const sanitized = input.replace(/[^a-zA-Z0-9_-]/g, '');
  return sanitized || 'default';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateVoiceoverResponse | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  if (!OPENAI_API_KEY) {
    return res.status(503).json({
      error: 'Voiceover generation is not configured. Please set OPENAI_API_KEY.',
    });
  }

  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  // Rate limiting: 10 voiceover generations per minute per user
  if (!checkRateLimit(`voiceover:${userId}`, 10, 60000)) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait before generating more voiceovers.',
    });
  }

  const { text, voice = 'nova', model = 'tts-1', speed = 1.0, projectId, sceneId } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const trimmedText = text.trim();
  if (trimmedText.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({
      error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`,
    });
  }

  if (!VALID_VOICES.includes(voice)) {
    return res.status(400).json({
      error: `Invalid voice. Must be one of: ${VALID_VOICES.join(', ')}`,
    });
  }

  if (!VALID_MODELS.includes(model)) {
    return res.status(400).json({
      error: `Invalid model. Must be one of: ${VALID_MODELS.join(', ')}`,
    });
  }

  const speedNum = Math.min(4.0, Math.max(0.25, Number(speed) || 1.0));

  // Calculate credit cost based on text length
  const creditCost = Math.max(1, Math.ceil((trimmedText.length / 1000) * VOICEOVER_CREDIT_COST_PER_1K));

  // Server-side credits validation
  const userCredits = await getUserCredits(userId);
  if (!userCredits) {
    return res.status(403).json({ error: 'User not found or credits not available' });
  }

  if (userCredits.creditsRemaining < creditCost) {
    return res.status(402).json({
      error: `Insufficient credits. This voiceover requires ${creditCost} credits.`,
      creditsRemaining: userCredits.creditsRemaining,
    });
  }

  try {
    // Generate audio using OpenAI TTS API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TTS_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model as TTSModel,
          input: trimmedText,
          voice: voice as Voice,
          response_format: 'mp3',
          speed: speedNum,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[generate-voiceover] OpenAI API error:', errorData);
      return res.status(500).json({
        success: false,
        error: (errorData as { error?: { message?: string } }).error?.message || 'Failed to generate voiceover',
      });
    }

    // Get the audio buffer
    const audioBuffer = Buffer.from(await response.arrayBuffer());

    // Try to persist to Supabase Storage
    let audioUrl: string;
    let urlType: 'permanent' | 'temporary' = 'temporary';

    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = getSupabaseServerClient();

        // Ensure bucket exists
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

        if (!bucketExists) {
          await supabase.storage.createBucket(BUCKET_NAME, {
            public: true,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav'],
          });
        }

        // Upload the audio file with sanitized path components
        const audioId = uuidv4();
        const safeProjectId = projectId ? sanitizePathComponent(projectId) : null;
        const safeSceneId = sceneId ? sanitizePathComponent(sceneId) : null;
        const safeUserId = sanitizePathComponent(userId);

        const filename = safeProjectId
          ? safeSceneId
            ? `${safeProjectId}/${safeSceneId}/${audioId}.mp3`
            : `${safeProjectId}/${audioId}.mp3`
          : `${safeUserId}/${audioId}.mp3`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filename, audioBuffer, {
            contentType: 'audio/mpeg',
            cacheControl: '31536000', // 1 year cache
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filename);

        audioUrl = publicUrl;
        urlType = 'permanent';
      } catch (storageError) {
        console.error('[generate-voiceover] Storage error:', storageError);
        // Fall back to base64 data URL
        audioUrl = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;
      }
    } else {
      // No storage configured - return base64 data URL
      audioUrl = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;
    }

    // Deduct credits for successful generation
    let deductResult;
    try {
      deductResult = await deductCredits(
        userId,
        creditCost,
        `Voiceover generation (${trimmedText.length} chars)`,
        sceneId,
        'generation'
      );
    } catch (error) {
      console.error('[generate-voiceover] Failed to deduct credits', {
        userId,
        creditCost,
        sceneId,
        error: error instanceof CreditError ? { code: error.code, message: error.message } : error,
      });
      // Credit integrity: fail the request if we cannot properly deduct credits
      if (error instanceof CreditError) {
        if (error.code === 'INSUFFICIENT_CREDITS') {
          return res.status(402).json({
            error: 'Insufficient credits. Your credits may have been used elsewhere.',
            creditsRemaining: 0,
          });
        }
        if (error.code === 'DB_UNAVAILABLE') {
          return res.status(503).json({
            success: false,
            error: 'Credit service temporarily unavailable. Please try again later.',
          });
        }
      }
      return res.status(500).json({
        success: false,
        error: 'Failed to process credits. Please try again.',
      });
    }

    // Estimate duration based on text length and speed
    // Average speaking rate is ~150 words per minute, or ~750 chars per minute
    const estimatedDuration = Math.round((trimmedText.length / 750) * 60 / speedNum);

    return res.status(200).json({
      success: true,
      audioUrl,
      urlType,
      duration: estimatedDuration,
      creditsRemaining: deductResult.creditsRemaining,
    });
  } catch (error) {
    console.error('[generate-voiceover] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate voiceover',
    });
  }
}

import { v4 as uuidv4 } from 'uuid';
import { getSupabaseServerClient, isSupabaseAdminConfigured } from './supabase';

const VIDEO_BUCKET_NAME = 'videos';
const AUDIO_BUCKET_NAME = 'audio';
const DOWNLOAD_TIMEOUT_MS = 60000; // 60 second timeout for media downloads (larger files)

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];

// Cache to avoid repeated bucket existence checks
const bucketVerified: Record<string, boolean> = {};

/**
 * Media Storage Utility
 *
 * Handles downloading temporary Replicate URLs and persisting them
 * to Supabase Storage for permanent access.
 *
 * Why this is needed:
 * - Replicate returns temporary URLs that expire after some time
 * - Storing these URLs in the database causes broken media after expiration
 * - Supabase Storage provides permanent, CDN-cached URLs
 */

/**
 * Sanitize a URL for safe logging (removes query parameters which may contain tokens)
 */
function sanitizeUrlForLogging(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '[invalid URL]';
  }
}

/**
 * Download media from a URL and return as a Buffer with content type.
 */
async function downloadMedia(
  url: string,
  allowedTypes: string[]
): Promise<{ buffer: Buffer; contentType: string }> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status} ${response.statusText}`);
    }

    const rawContentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentType = rawContentType.split(';')[0].trim();

    // Warn but don't fail for unexpected content types
    if (!allowedTypes.includes(contentType)) {
      console.warn(`[media-storage] Unexpected content type '${contentType}'`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Media download timed out after ${DOWNLOAD_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Ensure a storage bucket exists, creating it if necessary.
 */
async function ensureBucketExists(
  bucketName: string,
  allowedMimeTypes: string[],
  fileSizeLimit: number
): Promise<void> {
  if (bucketVerified[bucketName]) {
    return;
  }

  const supabase = getSupabaseServerClient();

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(`Failed to list storage buckets: ${listError.message}`);
  }

  const bucketExists = buckets?.some(b => b.name === bucketName);

  if (bucketExists) {
    bucketVerified[bucketName] = true;
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit,
    allowedMimeTypes,
  });

  if (createError) {
    const isDuplicateError =
      (createError as { code?: string }).code === '23505' ||
      createError.message.includes('already exists');

    if (!isDuplicateError) {
      throw new Error(`Failed to create storage bucket '${bucketName}': ${createError.message}`);
    }
  }

  bucketVerified[bucketName] = true;
}

/**
 * Get file extension from content type for video files.
 */
function getVideoExtension(contentType: string): string {
  const typeMap: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };
  return typeMap[contentType] || 'mp4';
}

/**
 * Get file extension from content type for audio files.
 */
function getAudioExtension(contentType: string): string {
  const typeMap: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
  };
  return typeMap[contentType] || 'mp3';
}

/**
 * Persist a video from a temporary URL to Supabase Storage.
 *
 * @param temporaryUrl - The temporary Replicate URL
 * @param projectId - The project ID (for organizing files)
 * @param sceneId - Optional scene ID (for organizing files)
 * @returns The permanent Supabase Storage URL, or original URL on failure
 */
export async function persistVideo(
  temporaryUrl: string,
  projectId: string,
  sceneId?: string
): Promise<string> {
  if (!isSupabaseAdminConfigured()) {
    console.warn('[media-storage] Supabase admin not configured, returning temporary video URL');
    return temporaryUrl;
  }

  try {
    // 500MB limit for videos
    await ensureBucketExists(VIDEO_BUCKET_NAME, ALLOWED_VIDEO_TYPES, 524288000);

    const { buffer, contentType } = await downloadMedia(temporaryUrl, ALLOWED_VIDEO_TYPES);

    const mediaId = uuidv4();
    const extension = getVideoExtension(contentType);
    const filename = sceneId
      ? `${projectId}/${sceneId}/${mediaId}.${extension}`
      : `${projectId}/${mediaId}.${extension}`;

    const supabase = getSupabaseServerClient();
    const { error: uploadError } = await supabase.storage
      .from(VIDEO_BUCKET_NAME)
      .upload(filename, buffer, {
        contentType,
        cacheControl: '31536000', // 1 year cache
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload video: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from(VIDEO_BUCKET_NAME)
      .getPublicUrl(filename);

    console.log('[media-storage] Video persisted successfully:', {
      originalUrl: sanitizeUrlForLogging(temporaryUrl),
      permanentUrl: publicUrl,
    });

    return publicUrl;
  } catch (error) {
    console.error('[media-storage] Failed to persist video:', error);
    return temporaryUrl;
  }
}

/**
 * Persist audio from a temporary URL to Supabase Storage.
 *
 * @param temporaryUrl - The temporary Replicate URL
 * @param projectId - The project ID (for organizing files)
 * @param sceneId - Optional scene ID (for organizing files)
 * @returns The permanent Supabase Storage URL, or original URL on failure
 */
export async function persistAudio(
  temporaryUrl: string,
  projectId: string,
  sceneId?: string
): Promise<string> {
  if (!isSupabaseAdminConfigured()) {
    console.warn('[media-storage] Supabase admin not configured, returning temporary audio URL');
    return temporaryUrl;
  }

  try {
    // 100MB limit for audio
    await ensureBucketExists(AUDIO_BUCKET_NAME, ALLOWED_AUDIO_TYPES, 104857600);

    const { buffer, contentType } = await downloadMedia(temporaryUrl, ALLOWED_AUDIO_TYPES);

    const mediaId = uuidv4();
    const extension = getAudioExtension(contentType);
    const filename = sceneId
      ? `${projectId}/${sceneId}/${mediaId}.${extension}`
      : `${projectId}/${mediaId}.${extension}`;

    const supabase = getSupabaseServerClient();
    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET_NAME)
      .upload(filename, buffer, {
        contentType,
        cacheControl: '31536000', // 1 year cache
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from(AUDIO_BUCKET_NAME)
      .getPublicUrl(filename);

    console.log('[media-storage] Audio persisted successfully:', {
      originalUrl: sanitizeUrlForLogging(temporaryUrl),
      permanentUrl: publicUrl,
    });

    return publicUrl;
  } catch (error) {
    console.error('[media-storage] Failed to persist audio:', error);
    return temporaryUrl;
  }
}

/**
 * Check if a URL is a temporary Replicate URL that may expire.
 */
export function isTemporaryReplicateUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.includes('replicate.delivery') ||
    url.includes('pbxt.replicate.delivery') ||
    url.includes('replicate.com/api/models')
  );
}

/**
 * Check if a URL is a temporary OpenAI URL that may expire.
 */
export function isTemporaryOpenAIUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.includes('oaidalleapiprodscus.blob.core.windows.net') ||
    url.includes('dalleproduse.blob.core.windows.net')
  );
}

/**
 * Check if a URL is likely to be a temporary/expiring URL.
 */
export function isTemporaryUrl(url: string): boolean {
  return isTemporaryReplicateUrl(url) || isTemporaryOpenAIUrl(url);
}

/**
 * Delete media from Supabase Storage.
 *
 * @param mediaUrl - The Supabase Storage URL to delete
 * @param bucketName - The bucket name (videos or audio)
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteMedia(mediaUrl: string, bucketName: string): Promise<boolean> {
  if (!isSupabaseAdminConfigured()) {
    return false;
  }

  if (!mediaUrl) {
    return false;
  }

  try {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(mediaUrl);
    } catch {
      return false;
    }

    const supabase = getSupabaseServerClient();

    const pathParts = parsedUrl.pathname.split(`/${bucketName}/`);

    if (pathParts.length < 2) {
      return false;
    }

    const filePath = pathParts[1];

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      console.error('[media-storage] Failed to delete media:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[media-storage] Error deleting media:', error);
    return false;
  }
}

/**
 * Reset bucket verification caches.
 * @internal For testing purposes only.
 */
export function resetBucketCaches(): void {
  Object.keys(bucketVerified).forEach(key => {
    delete bucketVerified[key];
  });
}

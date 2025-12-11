import { v4 as uuidv4 } from 'uuid';
import { getSupabaseServerClient, isSupabaseAdminConfigured } from './supabase';

const BUCKET_NAME = 'scene-images';
const DOWNLOAD_TIMEOUT_MS = 30000; // 30 second timeout for image downloads
const ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Cache to avoid repeated bucket existence checks
let bucketVerified = false;

/**
 * Image Storage Utility
 *
 * Handles downloading temporary OpenAI DALL-E URLs and persisting them
 * to Supabase Storage for permanent access.
 *
 * Why this is needed:
 * - OpenAI DALL-E 3 returns temporary URLs that expire after ~1 hour
 * - Storing these URLs in the database causes broken images after expiration
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
 * Download an image from a URL and return as a Buffer with content type.
 * Includes URL validation and timeout handling.
 *
 * @param url - The URL to download the image from
 * @returns Object containing the image buffer and detected content type
 * @throws Error if URL is invalid, request times out, or download fails
 */
async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Only allow HTTPS URLs for security
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed');
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    // Get content type from response headers, default to image/png
    const rawContentType = response.headers.get('content-type') || 'image/png';
    const contentType = rawContentType.split(';')[0].trim(); // Remove charset if present

    // Validate content type is an allowed image type
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      console.warn(`[image-storage] Unexpected content type '${contentType}', defaulting to image/png`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: ALLOWED_CONTENT_TYPES.includes(contentType) ? contentType : 'image/png',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Image download timed out after ${DOWNLOAD_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Ensure the storage bucket exists, creating it if necessary.
 * Uses a module-level cache to avoid repeated API calls.
 *
 * @throws Error if bucket creation fails
 */
async function ensureBucketExists(): Promise<void> {
  // Skip check if bucket was already verified in this process
  if (bucketVerified) {
    return;
  }

  const supabase = getSupabaseServerClient();

  // Check if bucket exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(`Failed to list storage buckets: ${listError.message}`);
  }

  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

  if (bucketExists) {
    // Mark bucket as verified immediately when found
    bucketVerified = true;
    return;
  }

  // Create the bucket with public access for images
  const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ALLOWED_CONTENT_TYPES,
  });

  if (createError) {
    // Check for duplicate key error (bucket created by concurrent request)
    // Supabase may return code '23505' or message containing 'already exists'
    const isDuplicateError =
      (createError as { code?: string }).code === '23505' ||
      createError.message.includes('already exists');

    if (!isDuplicateError) {
      throw new Error(`Failed to create storage bucket: ${createError.message}`);
    }
  }

  // Mark bucket as verified for future calls
  bucketVerified = true;
}

/**
 * Get file extension from content type.
 * Only supports allowed image types; throws for unsupported types.
 */
function getExtensionFromContentType(contentType: string): string {
  const typeMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  };

  const extension = typeMap[contentType];
  if (!extension) {
    // This shouldn't happen if downloadImage validates content types properly
    console.warn(`[image-storage] Unsupported content type '${contentType}', using png`);
    return 'png';
  }
  return extension;
}

/**
 * Persist an image from a temporary URL to Supabase Storage.
 *
 * Downloads the image from the temporary URL and uploads it to Supabase Storage,
 * returning a permanent URL. If persistence fails, returns the original URL
 * as a fallback (which will work for ~1 hour).
 *
 * @param temporaryUrl - The temporary OpenAI DALL-E URL
 * @param projectId - The project ID (for organizing files)
 * @param sceneId - Optional scene ID (for organizing files)
 * @returns The permanent Supabase Storage URL, or original URL on failure
 */
export async function persistImage(
  temporaryUrl: string,
  projectId: string,
  sceneId?: string
): Promise<string> {
  // If Supabase Storage isn't configured, return the original URL
  // This allows the app to work in development without Supabase
  if (!isSupabaseAdminConfigured()) {
    console.warn('[image-storage] Supabase admin not configured, returning temporary URL');
    return temporaryUrl;
  }

  try {
    // Ensure bucket exists
    await ensureBucketExists();

    // Download the image with content type detection
    const { buffer: imageBuffer, contentType } = await downloadImage(temporaryUrl);

    // Generate a unique filename with correct extension
    const imageId = uuidv4();
    const extension = getExtensionFromContentType(contentType);
    const filename = sceneId
      ? `${projectId}/${sceneId}/${imageId}.${extension}`
      : `${projectId}/${imageId}.${extension}`;

    // Upload to Supabase Storage
    const supabase = getSupabaseServerClient();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, imageBuffer, {
        contentType,
        cacheControl: '31536000', // 1 year cache
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    console.log('[image-storage] Image persisted successfully:', {
      originalUrl: sanitizeUrlForLogging(temporaryUrl),
      permanentUrl: publicUrl,
    });

    return publicUrl;
  } catch (error) {
    console.error('[image-storage] Failed to persist image:', error);
    // Return the original URL as fallback - it will work for ~1 hour
    return temporaryUrl;
  }
}

/**
 * Delete an image from Supabase Storage.
 *
 * @param imageUrl - The Supabase Storage URL to delete
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteImage(imageUrl: string): Promise<boolean> {
  if (!isSupabaseAdminConfigured()) {
    return false;
  }

  if (!imageUrl) {
    console.warn('[image-storage] deleteImage called with empty URL');
    return false;
  }

  try {
    // Validate and parse the URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      console.warn('[image-storage] deleteImage called with invalid URL');
      return false;
    }

    const supabase = getSupabaseServerClient();

    // Extract the file path from the URL
    const pathParts = parsedUrl.pathname.split(`/${BUCKET_NAME}/`);

    if (pathParts.length < 2) {
      // Not a Supabase Storage URL for this bucket
      return false;
    }

    const filePath = pathParts[1];

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('[image-storage] Failed to delete image:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[image-storage] Error deleting image:', error);
    return false;
  }
}

/**
 * Check if a URL is a persisted Supabase Storage URL.
 *
 * @param url - The URL to check
 * @returns true if the URL points to this app's Supabase Storage bucket
 */
export function isPersistedUrl(url: string): boolean {
  if (!url) return false;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    if (!supabaseUrl) return false;

    // Validate URL format and check if it matches Supabase Storage pattern
    const parsedUrl = new URL(url);
    const supabaseHost = new URL(supabaseUrl).host;

    return parsedUrl.host === supabaseHost &&
           parsedUrl.pathname.includes('/storage/') &&
           parsedUrl.pathname.includes(BUCKET_NAME);
  } catch {
    // URL parsing failures are expected for non-Supabase URLs
    return false;
  }
}

/**
 * Reset the bucket verification cache.
 * @internal This function is exported for testing purposes only and should not be used in production code.
 */
export function resetBucketCache(): void {
  bucketVerified = false;
}

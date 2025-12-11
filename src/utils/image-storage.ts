import { v4 as uuidv4 } from 'uuid';
import { getSupabaseServerClient, isSupabaseAdminConfigured } from './supabase';

const BUCKET_NAME = 'scene-images';

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
 * Download an image from a URL and return as a Buffer
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Ensure the storage bucket exists, creating it if necessary
 */
async function ensureBucketExists(): Promise<void> {
  const supabase = getSupabaseServerClient();

  // Check if bucket exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(`Failed to list storage buckets: ${listError.message}`);
  }

  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

  if (!bucketExists) {
    // Create the bucket with public access for images
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    });

    if (createError) {
      // Bucket might have been created by another request
      if (!createError.message.includes('already exists')) {
        throw new Error(`Failed to create storage bucket: ${createError.message}`);
      }
    }
  }
}

/**
 * Persist an image from a temporary URL to Supabase Storage
 *
 * @param temporaryUrl - The temporary OpenAI DALL-E URL
 * @param projectId - The project ID (for organizing files)
 * @param sceneId - Optional scene ID (for organizing files)
 * @returns The permanent Supabase Storage URL
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

    // Download the image
    const imageBuffer = await downloadImage(temporaryUrl);

    // Generate a unique filename
    const imageId = uuidv4();
    const filename = sceneId
      ? `${projectId}/${sceneId}/${imageId}.png`
      : `${projectId}/${imageId}.png`;

    // Upload to Supabase Storage
    const supabase = getSupabaseServerClient();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, imageBuffer, {
        contentType: 'image/png',
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
      originalUrl: temporaryUrl.substring(0, 50) + '...',
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
 * Delete an image from Supabase Storage
 *
 * @param imageUrl - The Supabase Storage URL to delete
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteImage(imageUrl: string): Promise<boolean> {
  if (!isSupabaseAdminConfigured()) {
    return false;
  }

  try {
    const supabase = getSupabaseServerClient();

    // Extract the file path from the URL
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split(`/${BUCKET_NAME}/`);

    if (pathParts.length < 2) {
      return false; // Not a Supabase Storage URL
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
 * Check if a URL is a persisted Supabase Storage URL
 */
export function isPersistedUrl(url: string): boolean {
  if (!url) return false;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    if (!supabaseUrl) return false;

    return url.includes(supabaseUrl) && url.includes(BUCKET_NAME);
  } catch {
    return false;
  }
}

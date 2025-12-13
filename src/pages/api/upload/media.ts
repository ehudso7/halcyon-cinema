import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { persistImage } from '@/utils/image-storage';
import { ApiError } from '@/types';

// Increase body size limit for media uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

interface UploadResponse {
  success: boolean;
  url?: string;
  type?: 'image' | 'video' | 'document';
  filename?: string;
  error?: string;
}

// Supported file types
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data, mimeType, filename, projectId } = req.body;

  if (!data || typeof data !== 'string') {
    return res.status(400).json({ error: 'Media data is required' });
  }

  if (!mimeType || typeof mimeType !== 'string') {
    return res.status(400).json({ error: 'MIME type is required' });
  }

  // Determine media type
  let mediaType: 'image' | 'video' | 'document';
  if (SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
    mediaType = 'image';
  } else if (SUPPORTED_VIDEO_TYPES.includes(mimeType)) {
    mediaType = 'video';
  } else if (SUPPORTED_DOCUMENT_TYPES.includes(mimeType)) {
    mediaType = 'document';
  } else {
    return res.status(400).json({
      error: `Unsupported file type: ${mimeType}. Supported: images (JPEG, PNG, GIF, WebP), videos (MP4, WebM, MOV), documents (PDF, TXT, MD, DOC, DOCX)`
    });
  }

  try {
    // For images, persist to storage
    if (mediaType === 'image') {
      // Validate base64 data URL format
      if (!data.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Invalid image data format' });
      }

      const imageUrl = await persistImage(data, projectId || 'uploads');

      return res.status(200).json({
        success: true,
        url: imageUrl,
        type: mediaType,
        filename: filename || 'uploaded-image',
      });
    }

    // For videos and documents, store as base64 for now
    // In production, these would be uploaded to cloud storage
    return res.status(200).json({
      success: true,
      url: data, // Return the data URL directly
      type: mediaType,
      filename: filename || `uploaded-${mediaType}`,
    });
  } catch (error) {
    console.error('[upload/media] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload media',
    });
  }
}

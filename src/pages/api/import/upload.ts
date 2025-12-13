import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { IncomingForm, File } from 'formidable';
import fs from 'fs';
import path from 'path';

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

interface UploadResponse {
  success: boolean;
  content?: string;
  filename?: string;
  wordCount?: number;
  charCount?: number;
  error?: string;
}

// Parse different file formats
async function parseFile(file: File): Promise<string> {
  const ext = path.extname(file.originalFilename || '').toLowerCase();
  const buffer = fs.readFileSync(file.filepath);

  switch (ext) {
    case '.txt':
      return buffer.toString('utf-8');

    case '.md':
      return buffer.toString('utf-8');

    case '.docx':
      return await parseDocx(buffer);

    case '.pdf':
      return await parsePdf(buffer);

    case '.epub':
      return await parseEpub(buffer);

    default:
      throw new Error(`Unsupported file format: ${ext}`);
  }
}

// Parse DOCX files
async function parseDocx(buffer: Buffer): Promise<string> {
  // DOCX is a ZIP file with XML content
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) {
    throw new Error('Invalid DOCX file: no document.xml found');
  }

  // Extract text from XML, preserving paragraph breaks
  let text = documentXml
    // Add newlines for paragraphs
    .replace(/<w:p[^>]*>/g, '\n')
    // Add newlines for line breaks
    .replace(/<w:br[^>]*>/g, '\n')
    // Extract text content
    .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1')
    // Remove all remaining XML tags
    .replace(/<[^>]+>/g, '')
    // Decode XML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Clean up multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

// Parse PDF files (basic text extraction)
async function parsePdf(buffer: Buffer): Promise<string> {
  // Basic PDF text extraction
  // For production, consider using pdf-parse or pdfjs-dist
  const content = buffer.toString('utf-8');

  // Try to extract text between stream markers
  const textParts: string[] = [];
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  let match;

  while ((match = streamRegex.exec(content)) !== null) {
    // Try to decode text from stream
    const stream = match[1];
    // Extract text operators (Tj, TJ, ')
    const textRegex = /\(([^)]*)\)\s*(?:Tj|')|<([0-9A-Fa-f]+)>\s*Tj/g;
    let textMatch;
    while ((textMatch = textRegex.exec(stream)) !== null) {
      if (textMatch[1]) {
        textParts.push(textMatch[1]);
      }
    }
  }

  if (textParts.length === 0) {
    // Fallback: try to find readable text
    const readableText = content
      .replace(/[^\x20-\x7E\n\r]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (readableText.length > 100) {
      return readableText;
    }

    throw new Error('Could not extract text from PDF. Please try converting to .txt or .docx format.');
  }

  return textParts.join(' ').replace(/\\n/g, '\n').replace(/\s+/g, ' ').trim();
}

// Parse EPUB files
async function parseEpub(buffer: Buffer): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  // Find the content files
  const textParts: string[] = [];

  // Process all HTML/XHTML files (sorted alphabetically - note: may not match spine order)
  const files = Object.keys(zip.files).filter(
    name => name.endsWith('.html') || name.endsWith('.xhtml') || name.endsWith('.htm')
  ).sort();

  for (const filename of files) {
    const html = await zip.file(filename)?.async('string');
    if (html) {
      // Extract text from HTML
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (text.length > 50) {
        textParts.push(text);
      }
    }
  }

  if (textParts.length === 0) {
    throw new Error('Could not extract text from EPUB file');
  }

  return textParts.join('\n\n---\n\n');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  let uploadedFile: File | undefined;

  try {
    const form = new IncomingForm({
      maxFileSize: 50 * 1024 * 1024, // 50MB
      keepExtensions: true,
    });

    const [, files] = await new Promise<[Record<string, unknown>, Record<string, File | File[]>]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files as Record<string, File | File[]>]);
      });
    });

    uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!uploadedFile) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Check file size
    if (uploadedFile.size > 50 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'File too large. Maximum size is 50MB.' });
    }

    // Parse the file
    const content = await parseFile(uploadedFile);

    // Calculate statistics
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    const charCount = content.length;

    console.log(`[import/upload] Parsed ${uploadedFile.originalFilename}: ${wordCount} words, ${charCount} chars`);

    return res.status(200).json({
      success: true,
      content,
      filename: uploadedFile.originalFilename || 'uploaded-file',
      wordCount,
      charCount,
    });
  } catch (error) {
    console.error('[import/upload] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process file',
    });
  } finally {
    // Clean up temp file regardless of success or failure
    if (uploadedFile?.filepath) {
      try {
        fs.unlinkSync(uploadedFile.filepath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

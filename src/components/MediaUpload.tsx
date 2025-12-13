import { useState, useRef, useCallback } from 'react';
import styles from './MediaUpload.module.css';

interface MediaUploadProps {
  onUpload: (result: UploadResult) => void;
  onAnalyze?: (analysis: DocumentAnalysis) => void;
  accept?: string;
  maxSize?: number; // in MB
  projectId?: string;
  allowAnalysis?: boolean;
}

interface UploadResult {
  success: boolean;
  url?: string;
  type?: 'image' | 'video' | 'document';
  filename?: string;
  error?: string;
}

interface DocumentAnalysis {
  content: string;
  summary?: string;
  suggestedScenes?: Array<{
    title: string;
    description: string;
    visualPrompt: string;
  }>;
  characters?: Array<{
    name: string;
    description: string;
    traits: string[];
  }>;
}

const DEFAULT_ACCEPT = 'image/*,video/*,.pdf,.txt,.md,.doc,.docx';
const DEFAULT_MAX_SIZE = 10; // 10MB

export default function MediaUpload({
  onUpload,
  onAnalyze,
  accept = DEFAULT_ACCEPT,
  maxSize = DEFAULT_MAX_SIZE,
  projectId,
  allowAnalysis = true,
}: MediaUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; type: string; url?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFile = async (file: File) => {
    setError(null);

    // Validate file size
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSize) {
      setError(`File too large. Maximum size is ${maxSize}MB.`);
      return;
    }

    setIsUploading(true);
    setUploadedFile({ name: file.name, type: file.type });

    try {
      // Read file as base64
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload to server
      const response = await fetch('/api/upload/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: dataUrl,
          mimeType: file.type,
          filename: file.name,
          projectId,
        }),
      });

      const result: UploadResult = await response.json();

      if (result.success) {
        setUploadedFile({ name: file.name, type: file.type, url: result.url });
        onUpload(result);
      } else {
        setError(result.error || 'Upload failed');
        setUploadedFile(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyzeDocument = async () => {
    if (!uploadedFile?.url || !onAnalyze) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // For documents, we need to extract text content first
      // If it's a data URL, we can send it directly
      const response = await fetch('/api/upload/document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: uploadedFile.url, // This would be parsed by the API
          filename: uploadedFile.name,
          analyzeForScenes: true,
        }),
      });

      const analysis = await response.json();

      if (analysis.success) {
        onAnalyze(analysis);
      } else {
        setError(analysis.error || 'Analysis failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRemove = () => {
    setUploadedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isDocument = uploadedFile?.type.includes('pdf') ||
    uploadedFile?.type.includes('text') ||
    uploadedFile?.type.includes('document') ||
    uploadedFile?.type.includes('markdown');

  return (
    <div className={styles.container}>
      {!uploadedFile ? (
        <div
          className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className={styles.fileInput}
          />

          {isUploading ? (
            <div className={styles.uploading}>
              <div className={styles.spinner} />
              <span>Uploading...</span>
            </div>
          ) : (
            <>
              <div className={styles.icon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className={styles.text}>
                <strong>Drag and drop</strong> your file here, or click to browse
              </p>
              <p className={styles.hint}>
                Images, videos, and documents up to {maxSize}MB
              </p>
            </>
          )}
        </div>
      ) : (
        <div className={styles.preview}>
          <div className={styles.fileInfo}>
            <div className={styles.fileIcon}>
              {uploadedFile.type.startsWith('image/') ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              ) : uploadedFile.type.startsWith('video/') ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              )}
            </div>
            <div className={styles.fileName}>
              <span className={styles.name}>{uploadedFile.name}</span>
              <span className={styles.type}>{uploadedFile.type}</span>
            </div>
            <button className={styles.removeBtn} onClick={handleRemove} title="Remove file">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Document analysis option */}
          {isDocument && allowAnalysis && onAnalyze && (
            <div className={styles.analyzeSection}>
              <p className={styles.analyzeHint}>
                Let AI analyze this document and suggest scenes and characters
              </p>
              <button
                className={styles.analyzeBtn}
                onClick={handleAnalyzeDocument}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <span className={styles.spinnerSmall} />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    Analyze with AI
                  </>
                )}
              </button>
            </div>
          )}

          {/* Image preview */}
          {uploadedFile.type.startsWith('image/') && uploadedFile.url && (
            <div className={styles.imagePreview}>
              <img src={uploadedFile.url} alt={uploadedFile.name} />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}

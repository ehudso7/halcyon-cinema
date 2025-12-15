'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './ImageWithFallback.module.css';

interface ImageWithFallbackProps {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  priority?: boolean;
  fallbackType?: 'scene' | 'project' | 'character' | 'generic';
  onLoad?: () => void;
  showExpiredMessage?: boolean;
}

// Generate a consistent gradient based on string hash
function generateGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 40) % 360;

  return `linear-gradient(135deg, hsl(${hue1}, 70%, 25%) 0%, hsl(${hue2}, 60%, 15%) 100%)`;
}

// Get icon based on fallback type
function getFallbackIcon(type: ImageWithFallbackProps['fallbackType'], isExpired: boolean = false) {
  if (isExpired) {
    return (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }

  switch (type) {
    case 'scene':
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
          <line x1="7" y1="2" x2="7" y2="22" />
          <line x1="17" y1="2" x2="17" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="2" y1="7" x2="7" y2="7" />
          <line x1="2" y1="17" x2="7" y2="17" />
          <line x1="17" y1="17" x2="22" y2="17" />
          <line x1="17" y1="7" x2="22" y2="7" />
        </svg>
      );
    case 'project':
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      );
    case 'character':
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      );
  }
}

export default function ImageWithFallback({
  src,
  alt,
  fill = false,
  width,
  height,
  sizes,
  className = '',
  priority = false,
  fallbackType = 'generic',
  onLoad,
  showExpiredMessage = true,
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset states when src changes
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  // Check if the URL looks like a temporary URL that may expire
  // OpenAI DALL-E URLs expire after ~1 hour
  // Replicate URLs also expire after some time
  const isLikelyExpiredUrl = src && (
    // OpenAI DALL-E temporary URLs
    src.includes('oaidalleapiprodscus.blob.core.windows.net') ||
    src.includes('dalleproduse.blob.core.windows.net') ||
    // Replicate temporary URLs
    src.includes('replicate.delivery') ||
    src.includes('pbxt.replicate.delivery') ||
    src.includes('replicate.com/api/models')
  );

  // If no src or error, show fallback
  if (!src || hasError) {
    const gradient = generateGradient(alt || 'default');
    const isExpired = hasError && !!isLikelyExpiredUrl;

    return (
      <div
        className={`${styles.fallback} ${className}`}
        style={{ background: gradient }}
      >
        <div className={styles.fallbackContent}>
          {getFallbackIcon(fallbackType, isExpired)}
          {isExpired && showExpiredMessage ? (
            <>
              <span className={styles.expiredText}>Image Expired</span>
              <span className={styles.expiredHint}>Use the regenerate button to restore</span>
            </>
          ) : (
            <span className={styles.fallbackText}>{alt}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.imageContainer} ${className}`}>
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.shimmer} />
        </div>
      )}
      {fill ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={`${styles.image} ${isLoading ? styles.hidden : ''}`}
          onLoad={() => {
            setIsLoading(false);
            onLoad?.();
          }}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          className={`${styles.image} ${isLoading ? styles.hidden : ''}`}
          onLoad={() => {
            setIsLoading(false);
            onLoad?.();
          }}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
        />
      )}
    </div>
  );
}

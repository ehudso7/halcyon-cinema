/**
 * Error message sanitization utilities
 *
 * Sanitizes error messages from external services (like Replicate, OpenAI)
 * to provide user-friendly messages without exposing internal service details.
 */

/**
 * Patterns that indicate Replicate-specific billing/credit messages
 */
const REPLICATE_BILLING_PATTERNS = [
  /insufficient credit/i,
  /purchase credit/i,
  /replicate\.com\/account\/billing/i,
  /go to https?:\/\/replicate/i,
  /billing#billing/i,
];

/**
 * Patterns that indicate rate limiting from external services
 */
const RATE_LIMIT_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /quota exceeded/i,
];

/**
 * Patterns that indicate authentication/authorization issues
 */
const AUTH_PATTERNS = [
  /api key/i,
  /authentication/i,
  /unauthorized/i,
  /forbidden/i,
  /invalid.*token/i,
];

/**
 * Sanitizes an error message from Replicate or other external AI services
 * to provide a user-friendly message without exposing internal billing details.
 *
 * @param error - The raw error message or Error object
 * @param mediaType - The type of media being generated (for context in messages)
 * @returns A sanitized, user-friendly error message
 */
export function sanitizeGenerationError(
  error: string | Error | unknown,
  mediaType: 'video' | 'image' | 'music' | 'voiceover' = 'video'
): string {
  const errorMessage = error instanceof Error ? error.message : String(error || '');

  // Check for Replicate billing/credit errors - replace with generic message
  if (REPLICATE_BILLING_PATTERNS.some(pattern => pattern.test(errorMessage))) {
    return `${capitalize(mediaType)} generation is temporarily unavailable. Please try again later or contact support if the issue persists.`;
  }

  // Check for rate limiting
  if (RATE_LIMIT_PATTERNS.some(pattern => pattern.test(errorMessage))) {
    return `${capitalize(mediaType)} generation rate limit exceeded. Please wait a moment and try again.`;
  }

  // Check for auth issues - these shouldn't be shown to users in detail
  if (AUTH_PATTERNS.some(pattern => pattern.test(errorMessage))) {
    return `${capitalize(mediaType)} generation service is currently unavailable. Please try again later.`;
  }

  // Check for URLs in error messages and remove them
  if (/https?:\/\/[^\s]+/.test(errorMessage)) {
    // Remove URLs but keep the rest of the message
    const cleanedMessage = errorMessage
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // If the message is now empty or too short, return a generic message
    if (cleanedMessage.length < 10) {
      return `${capitalize(mediaType)} generation failed. Please try again.`;
    }

    return cleanedMessage;
  }

  // Return the original message if it doesn't match any patterns
  // but ensure it's not empty
  return errorMessage || `${capitalize(mediaType)} generation failed`;
}

/**
 * Capitalizes the first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Default error messages for different media types
 */
export const DEFAULT_ERROR_MESSAGES = {
  video: 'Video generation failed. Please try again.',
  image: 'Image generation failed. Please try again.',
  music: 'Music generation failed. Please try again.',
  voiceover: 'Voiceover generation failed. Please try again.',
} as const;

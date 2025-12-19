import { describe, it, expect } from 'vitest';
import { sanitizeGenerationError, DEFAULT_ERROR_MESSAGES } from '@/utils/error-sanitizer';

describe('Error Sanitizer', () => {
  describe('sanitizeGenerationError', () => {
    it('should sanitize Replicate billing errors', () => {
      const replicateError = 'You have insufficient credit to run this model. Go to https://replicate.com/account/billing#billing to purchase credit.';
      const result = sanitizeGenerationError(replicateError, 'video');

      expect(result).not.toContain('replicate.com');
      expect(result).not.toContain('billing');
      expect(result).not.toContain('purchase credit');
      expect(result).toContain('temporarily unavailable');
    });

    it('should sanitize errors with URLs', () => {
      const errorWithUrl = 'Error occurred at https://api.example.com/v1/endpoint - please check';
      const result = sanitizeGenerationError(errorWithUrl, 'video');

      expect(result).not.toContain('https://');
      expect(result).not.toContain('api.example.com');
    });

    it('should handle rate limit errors', () => {
      const rateLimitError = 'Rate limit exceeded. Please try again later.';
      const result = sanitizeGenerationError(rateLimitError, 'video');

      expect(result).toContain('rate limit');
    });

    it('should handle authentication errors', () => {
      const authError = 'Invalid API key provided';
      const result = sanitizeGenerationError(authError, 'video');

      expect(result).not.toContain('API key');
      expect(result).toContain('unavailable');
    });

    it('should handle Error objects', () => {
      const error = new Error('You have insufficient credit to run this model');
      const result = sanitizeGenerationError(error, 'video');

      expect(result).toContain('temporarily unavailable');
    });

    it('should capitalize media type in message', () => {
      const result = sanitizeGenerationError('insufficient credit', 'music');
      expect(result).toMatch(/^Music/);
    });

    it('should return original message if not matching patterns', () => {
      const normalError = 'Something went wrong during processing';
      const result = sanitizeGenerationError(normalError, 'video');

      expect(result).toBe('Something went wrong during processing');
    });

    it('should handle empty error messages', () => {
      const result = sanitizeGenerationError('', 'video');
      expect(result).toBe('Video generation failed');
    });

    it('should handle null/undefined errors', () => {
      const result = sanitizeGenerationError(null, 'video');
      expect(result).toBe('Video generation failed');
    });
  });

  describe('DEFAULT_ERROR_MESSAGES', () => {
    it('should have messages for all media types', () => {
      expect(DEFAULT_ERROR_MESSAGES.video).toBeDefined();
      expect(DEFAULT_ERROR_MESSAGES.image).toBeDefined();
      expect(DEFAULT_ERROR_MESSAGES.music).toBeDefined();
      expect(DEFAULT_ERROR_MESSAGES.voiceover).toBeDefined();
    });
  });
});

/**
 * Production Configuration
 *
 * This module provides optimal configuration for video, music, voiceover,
 * and caption generation to achieve modern production quality output.
 *
 * The system automatically selects the best settings based on:
 * - Content type (cinematic, documentary, commercial, etc.)
 * - Target platform (cinema, streaming, social media)
 * - Quality tier (standard, professional, premium)
 */

// ============================================================================
// Types
// ============================================================================

export type ContentType = 'cinematic' | 'documentary' | 'commercial' | 'music_video' | 'short_form' | 'narrative';
export type TargetPlatform = 'cinema' | 'streaming' | 'social_media' | 'broadcast';
export type QualityTier = 'standard' | 'professional' | 'premium';

export interface ProductionProfile {
  id: string;
  name: string;
  description: string;
  contentType: ContentType;
  targetPlatform: TargetPlatform;
  qualityTier: QualityTier;
  video: VideoConfig;
  audio: AudioConfig;
  voiceover: VoiceoverConfig;
  captions: CaptionConfig;
}

export interface VideoConfig {
  provider: 'replicate' | 'runway' | 'stability' | 'openai';
  model: string;
  resolution: '720p' | '1080p' | '4k';
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
  fps: 24 | 30 | 60;
  duration: 'short' | 'medium' | 'long';
  style: string;
  motionIntensity: 'subtle' | 'moderate' | 'dynamic';
  colorGrading: string;
}

export interface AudioConfig {
  provider: 'replicate' | 'elevenlabs' | 'suno';
  model: string;
  genre: string;
  mood: string;
  tempo: 'slow' | 'moderate' | 'fast' | 'dynamic';
  duration: number; // seconds
  includeVocals: boolean;
  vocalStyle?: string;
  instrumentalBalance: number; // 0-100, higher = more instrumental
  loudnessTarget: number; // LUFS
  stereoWidth: 'narrow' | 'standard' | 'wide';
}

export interface VoiceoverConfig {
  provider: 'openai' | 'elevenlabs' | 'google';
  model: string;
  voice: string;
  speed: number;
  pitch: number;
  emotionalTone: string;
  clarity: 'broadcast' | 'natural' | 'intimate';
}

export interface CaptionConfig {
  enabled: boolean;
  style: 'standard' | 'cinematic' | 'social' | 'accessible';
  position: 'bottom' | 'top' | 'center';
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: string;
  backgroundColor: string;
  textColor: string;
  animation: 'none' | 'fade' | 'slide' | 'typewriter';
  timing: 'word' | 'phrase' | 'sentence';
}

// ============================================================================
// Production Profiles
// ============================================================================

export const PRODUCTION_PROFILES: Record<string, ProductionProfile> = {
  // Cinema-quality production for theatrical/streaming release
  'cinematic-premium': {
    id: 'cinematic-premium',
    name: 'Cinematic Premium',
    description: 'Hollywood-quality production with cinematic visuals, orchestral score, and professional voiceover',
    contentType: 'cinematic',
    targetPlatform: 'cinema',
    qualityTier: 'premium',
    video: {
      provider: 'runway',
      model: 'gen-3-alpha',
      resolution: '4k',
      aspectRatio: '21:9',
      fps: 24,
      duration: 'medium',
      style: 'cinematic',
      motionIntensity: 'dynamic',
      colorGrading: 'filmic-warm',
    },
    audio: {
      provider: 'suno',
      model: 'v3.5',
      genre: 'orchestral',
      mood: 'epic',
      tempo: 'dynamic',
      duration: 30,
      includeVocals: true,
      vocalStyle: 'cinematic-choir',
      instrumentalBalance: 70,
      loudnessTarget: -14,
      stereoWidth: 'wide',
    },
    voiceover: {
      provider: 'elevenlabs',
      model: 'eleven_multilingual_v2',
      voice: 'narrator-deep',
      speed: 0.95,
      pitch: 0,
      emotionalTone: 'dramatic',
      clarity: 'broadcast',
    },
    captions: {
      enabled: true,
      style: 'cinematic',
      position: 'bottom',
      fontSize: 'medium',
      fontFamily: 'Inter',
      backgroundColor: 'rgba(0,0,0,0.6)',
      textColor: '#ffffff',
      animation: 'fade',
      timing: 'phrase',
    },
  },

  // Professional streaming content (Netflix, YouTube Premium)
  'streaming-professional': {
    id: 'streaming-professional',
    name: 'Streaming Professional',
    description: 'High-quality production optimized for streaming platforms',
    contentType: 'narrative',
    targetPlatform: 'streaming',
    qualityTier: 'professional',
    video: {
      provider: 'runway',
      model: 'gen-3-alpha',
      resolution: '1080p',
      aspectRatio: '16:9',
      fps: 30,
      duration: 'medium',
      style: 'modern-cinematic',
      motionIntensity: 'moderate',
      colorGrading: 'natural-enhanced',
    },
    audio: {
      provider: 'suno',
      model: 'v3.5',
      genre: 'cinematic',
      mood: 'emotional',
      tempo: 'moderate',
      duration: 30,
      includeVocals: true,
      vocalStyle: 'contemporary',
      instrumentalBalance: 60,
      loudnessTarget: -16,
      stereoWidth: 'standard',
    },
    voiceover: {
      provider: 'openai',
      model: 'tts-1-hd',
      voice: 'nova',
      speed: 1.0,
      pitch: 0,
      emotionalTone: 'engaging',
      clarity: 'natural',
    },
    captions: {
      enabled: true,
      style: 'standard',
      position: 'bottom',
      fontSize: 'medium',
      fontFamily: 'Roboto',
      backgroundColor: 'rgba(0,0,0,0.7)',
      textColor: '#ffffff',
      animation: 'fade',
      timing: 'phrase',
    },
  },

  // Social media optimized (TikTok, Reels, Shorts)
  'social-viral': {
    id: 'social-viral',
    name: 'Social Media Viral',
    description: 'Fast-paced, attention-grabbing content for social platforms',
    contentType: 'short_form',
    targetPlatform: 'social_media',
    qualityTier: 'professional',
    video: {
      provider: 'runway',
      model: 'gen-3-alpha',
      resolution: '1080p',
      aspectRatio: '9:16',
      fps: 30,
      duration: 'short',
      style: 'trendy',
      motionIntensity: 'dynamic',
      colorGrading: 'vibrant',
    },
    audio: {
      provider: 'suno',
      model: 'v3.5',
      genre: 'pop',
      mood: 'energetic',
      tempo: 'fast',
      duration: 15,
      includeVocals: true,
      vocalStyle: 'modern-pop',
      instrumentalBalance: 40,
      loudnessTarget: -14,
      stereoWidth: 'wide',
    },
    voiceover: {
      provider: 'openai',
      model: 'tts-1-hd',
      voice: 'shimmer',
      speed: 1.1,
      pitch: 0,
      emotionalTone: 'energetic',
      clarity: 'natural',
    },
    captions: {
      enabled: true,
      style: 'social',
      position: 'center',
      fontSize: 'large',
      fontFamily: 'Montserrat',
      backgroundColor: 'transparent',
      textColor: '#ffffff',
      animation: 'typewriter',
      timing: 'word',
    },
  },

  // Documentary style
  'documentary-professional': {
    id: 'documentary-professional',
    name: 'Documentary Professional',
    description: 'Authentic, story-driven content with natural aesthetics',
    contentType: 'documentary',
    targetPlatform: 'streaming',
    qualityTier: 'professional',
    video: {
      provider: 'runway',
      model: 'gen-3-alpha',
      resolution: '1080p',
      aspectRatio: '16:9',
      fps: 24,
      duration: 'long',
      style: 'documentary',
      motionIntensity: 'subtle',
      colorGrading: 'natural',
    },
    audio: {
      provider: 'suno',
      model: 'v3.5',
      genre: 'ambient',
      mood: 'contemplative',
      tempo: 'slow',
      duration: 60,
      includeVocals: false,
      instrumentalBalance: 100,
      loudnessTarget: -18,
      stereoWidth: 'standard',
    },
    voiceover: {
      provider: 'elevenlabs',
      model: 'eleven_multilingual_v2',
      voice: 'narrator-warm',
      speed: 0.9,
      pitch: 0,
      emotionalTone: 'thoughtful',
      clarity: 'broadcast',
    },
    captions: {
      enabled: true,
      style: 'accessible',
      position: 'bottom',
      fontSize: 'medium',
      fontFamily: 'Open Sans',
      backgroundColor: 'rgba(0,0,0,0.8)',
      textColor: '#ffffff',
      animation: 'none',
      timing: 'sentence',
    },
  },

  // Standard quality for general use
  'standard': {
    id: 'standard',
    name: 'Standard Quality',
    description: 'Good quality production for everyday content',
    contentType: 'narrative',
    targetPlatform: 'streaming',
    qualityTier: 'standard',
    video: {
      provider: 'replicate',
      model: 'zeroscope-v2-xl',
      resolution: '720p',
      aspectRatio: '16:9',
      fps: 24,
      duration: 'short',
      style: 'natural',
      motionIntensity: 'moderate',
      colorGrading: 'balanced',
    },
    audio: {
      provider: 'replicate',
      model: 'musicgen-stereo-large',
      genre: 'cinematic',
      mood: 'neutral',
      tempo: 'moderate',
      duration: 30,
      includeVocals: false,
      instrumentalBalance: 100,
      loudnessTarget: -16,
      stereoWidth: 'standard',
    },
    voiceover: {
      provider: 'openai',
      model: 'tts-1',
      voice: 'nova',
      speed: 1.0,
      pitch: 0,
      emotionalTone: 'neutral',
      clarity: 'natural',
    },
    captions: {
      enabled: true,
      style: 'standard',
      position: 'bottom',
      fontSize: 'medium',
      fontFamily: 'Arial',
      backgroundColor: 'rgba(0,0,0,0.7)',
      textColor: '#ffffff',
      animation: 'none',
      timing: 'phrase',
    },
  },
};

// ============================================================================
// Auto-Selection Logic
// ============================================================================

/**
 * Automatically select the best production profile based on project context
 */
export function selectBestProfile(options: {
  contentType?: ContentType;
  targetPlatform?: TargetPlatform;
  qualityTier?: QualityTier;
  genre?: string;
  mood?: string;
}): ProductionProfile {
  const { contentType, targetPlatform, qualityTier, genre, mood } = options;

  // Score each profile based on how well it matches the requirements
  let bestProfile = PRODUCTION_PROFILES['standard'];
  let bestScore = 0;

  for (const profile of Object.values(PRODUCTION_PROFILES)) {
    let score = 0;

    if (contentType && profile.contentType === contentType) score += 30;
    if (targetPlatform && profile.targetPlatform === targetPlatform) score += 25;
    if (qualityTier && profile.qualityTier === qualityTier) score += 20;
    if (genre && profile.audio.genre.toLowerCase().includes(genre.toLowerCase())) score += 15;
    if (mood && profile.audio.mood.toLowerCase().includes(mood.toLowerCase())) score += 10;

    if (score > bestScore) {
      bestScore = score;
      bestProfile = profile;
    }
  }

  return bestProfile;
}

/**
 * Get optimal audio settings based on scene context
 */
export function getOptimalAudioSettings(sceneContext: {
  mood?: string;
  pacing?: 'slow' | 'medium' | 'fast';
  hasDialogue?: boolean;
  emotionalIntensity?: number; // 0-100
}): Partial<AudioConfig> {
  const { mood = 'neutral', pacing = 'medium', hasDialogue = false, emotionalIntensity = 50 } = sceneContext;

  // Map mood to genre/style
  const moodToGenre: Record<string, string> = {
    happy: 'upbeat',
    sad: 'melancholic',
    tense: 'suspense',
    epic: 'orchestral',
    romantic: 'romantic',
    mysterious: 'ambient',
    action: 'electronic',
    peaceful: 'ambient',
    dark: 'dark-ambient',
    hopeful: 'inspirational',
    neutral: 'cinematic',
  };

  // Map pacing to tempo
  const pacingToTempo: Record<string, 'slow' | 'moderate' | 'fast' | 'dynamic'> = {
    slow: 'slow',
    medium: 'moderate',
    fast: 'fast',
  };

  return {
    genre: moodToGenre[mood] || 'cinematic',
    mood,
    tempo: pacingToTempo[pacing] || 'moderate',
    includeVocals: !hasDialogue && emotionalIntensity > 60,
    instrumentalBalance: hasDialogue ? 85 : 60,
    loudnessTarget: hasDialogue ? -20 : -16,
  };
}

/**
 * Get optimal voiceover settings based on content type
 */
export function getOptimalVoiceoverSettings(contentContext: {
  contentType?: ContentType;
  targetAudience?: 'general' | 'professional' | 'children' | 'young_adult';
  emotionalTone?: string;
}): Partial<VoiceoverConfig> {
  const { contentType = 'narrative', targetAudience = 'general', emotionalTone = 'engaging' } = contentContext;

  // Select voice based on content type and audience
  const voiceMap: Record<string, string> = {
    cinematic: 'echo',
    documentary: 'onyx',
    commercial: 'nova',
    narrative: 'nova',
    children: 'shimmer',
    young_adult: 'alloy',
  };

  const voice = voiceMap[contentType] || voiceMap[targetAudience] || 'nova';

  // Adjust speed based on content type
  const speedMap: Record<string, number> = {
    cinematic: 0.95,
    documentary: 0.9,
    commercial: 1.05,
    short_form: 1.1,
    narrative: 1.0,
  };

  return {
    voice,
    speed: speedMap[contentType] || 1.0,
    emotionalTone,
    clarity: contentType === 'documentary' ? 'broadcast' : 'natural',
  };
}

/**
 * Get optimal caption settings based on platform
 */
export function getOptimalCaptionSettings(platformContext: {
  platform?: TargetPlatform;
  hasAudioDescription?: boolean;
  isAccessibilityRequired?: boolean;
}): CaptionConfig {
  const { platform = 'streaming', hasAudioDescription = false, isAccessibilityRequired = false } = platformContext;

  if (isAccessibilityRequired) {
    return {
      enabled: true,
      style: 'accessible',
      position: 'bottom',
      fontSize: 'large',
      fontFamily: 'Open Sans',
      backgroundColor: 'rgba(0,0,0,0.9)',
      textColor: '#ffffff',
      animation: 'none',
      timing: 'sentence',
    };
  }

  const platformSettings: Record<TargetPlatform, CaptionConfig> = {
    cinema: {
      enabled: true,
      style: 'cinematic',
      position: 'bottom',
      fontSize: 'medium',
      fontFamily: 'Inter',
      backgroundColor: 'rgba(0,0,0,0.6)',
      textColor: '#ffffff',
      animation: 'fade',
      timing: 'phrase',
    },
    streaming: {
      enabled: true,
      style: 'standard',
      position: 'bottom',
      fontSize: 'medium',
      fontFamily: 'Roboto',
      backgroundColor: 'rgba(0,0,0,0.75)',
      textColor: '#ffffff',
      animation: 'fade',
      timing: 'phrase',
    },
    social_media: {
      enabled: true,
      style: 'social',
      position: 'center',
      fontSize: 'large',
      fontFamily: 'Montserrat',
      backgroundColor: 'transparent',
      textColor: '#ffffff',
      animation: 'typewriter',
      timing: 'word',
    },
    broadcast: {
      enabled: true,
      style: 'standard',
      position: 'bottom',
      fontSize: 'medium',
      fontFamily: 'Arial',
      backgroundColor: 'rgba(0,0,0,0.8)',
      textColor: '#ffffff',
      animation: 'none',
      timing: 'sentence',
    },
  };

  return platformSettings[platform];
}

// ============================================================================
// Exports
// ============================================================================

export default {
  profiles: PRODUCTION_PROFILES,
  selectBestProfile,
  getOptimalAudioSettings,
  getOptimalVoiceoverSettings,
  getOptimalCaptionSettings,
};

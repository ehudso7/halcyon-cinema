/**
 * Production Mixer Service
 *
 * This service handles the orchestration of video, music, voiceover, and captions
 * to produce modern, production-quality output. It automatically selects optimal
 * settings and coordinates the generation pipeline.
 */

import {
  ProductionProfile,
  selectBestProfile,
  getOptimalAudioSettings,
  getOptimalVoiceoverSettings,
  getOptimalCaptionSettings,
  PRODUCTION_PROFILES,
  ContentType,
  TargetPlatform,
  QualityTier,
} from '@/config/production-config';

// ============================================================================
// Types
// ============================================================================

export interface ProductionRequest {
  projectId: string;
  sceneId: string;
  prompt: string;
  profileId?: string; // Use specific profile or auto-select
  options?: {
    contentType?: ContentType;
    targetPlatform?: TargetPlatform;
    qualityTier?: QualityTier;
    genre?: string;
    mood?: string;
    pacing?: 'slow' | 'medium' | 'fast';
    hasDialogue?: boolean;
    script?: string;
    includeVoiceover?: boolean;
    includeCaptions?: boolean;
    includeMusic?: boolean;
  };
}

export interface ProductionResult {
  success: boolean;
  videoUrl?: string;
  audioUrl?: string;
  voiceoverUrl?: string;
  captionsUrl?: string;
  combinedUrl?: string; // Final mixed output
  profile: ProductionProfile;
  creditsUsed: number;
  processingTime: number;
  error?: string;
}

export interface ProductionStatus {
  stage: 'initializing' | 'generating_video' | 'generating_audio' | 'generating_voiceover' | 'generating_captions' | 'mixing' | 'complete' | 'failed';
  progress: number; // 0-100
  currentTask?: string;
  estimatedTimeRemaining?: number; // seconds
}

// ============================================================================
// Production Mixer Class
// ============================================================================

export class ProductionMixer {
  private profile: ProductionProfile;
  private statusCallback?: (status: ProductionStatus) => void;

  constructor(profileId?: string) {
    this.profile = profileId
      ? PRODUCTION_PROFILES[profileId] || PRODUCTION_PROFILES['standard']
      : PRODUCTION_PROFILES['standard'];
  }

  /**
   * Set the production profile
   */
  setProfile(profile: ProductionProfile): void {
    this.profile = profile;
  }

  /**
   * Auto-select the best profile based on context
   */
  autoSelectProfile(options: {
    contentType?: ContentType;
    targetPlatform?: TargetPlatform;
    qualityTier?: QualityTier;
    genre?: string;
    mood?: string;
  }): ProductionProfile {
    this.profile = selectBestProfile(options);
    return this.profile;
  }

  /**
   * Set status callback for progress updates
   */
  onStatusUpdate(callback: (status: ProductionStatus) => void): void {
    this.statusCallback = callback;
  }

  /**
   * Update status
   */
  private updateStatus(status: ProductionStatus): void {
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  /**
   * Generate production-quality output
   */
  async produce(request: ProductionRequest): Promise<ProductionResult> {
    const startTime = Date.now();
    let creditsUsed = 0;

    // Auto-select profile if not specified
    if (!request.profileId && request.options) {
      this.autoSelectProfile({
        contentType: request.options.contentType,
        targetPlatform: request.options.targetPlatform,
        qualityTier: request.options.qualityTier,
        genre: request.options.genre,
        mood: request.options.mood,
      });
    }

    this.updateStatus({
      stage: 'initializing',
      progress: 0,
      currentTask: 'Preparing production pipeline...',
    });

    try {
      const results: {
        videoUrl?: string;
        audioUrl?: string;
        voiceoverUrl?: string;
        captionsUrl?: string;
      } = {};

      // Step 1: Generate Video (40% of progress)
      this.updateStatus({
        stage: 'generating_video',
        progress: 5,
        currentTask: 'Generating video content...',
        estimatedTimeRemaining: 120,
      });

      const videoResult = await this.generateVideo(request);
      if (videoResult.success && videoResult.url) {
        results.videoUrl = videoResult.url;
        creditsUsed += videoResult.creditsUsed;
      }

      this.updateStatus({
        stage: 'generating_video',
        progress: 40,
        currentTask: 'Video generation complete',
      });

      // Step 2: Generate Audio/Music (25% of progress)
      if (request.options?.includeMusic !== false) {
        this.updateStatus({
          stage: 'generating_audio',
          progress: 45,
          currentTask: 'Composing soundtrack...',
          estimatedTimeRemaining: 60,
        });

        const audioResult = await this.generateAudio(request);
        if (audioResult.success && audioResult.url) {
          results.audioUrl = audioResult.url;
          creditsUsed += audioResult.creditsUsed;
        }

        this.updateStatus({
          stage: 'generating_audio',
          progress: 65,
          currentTask: 'Soundtrack complete',
        });
      }

      // Step 3: Generate Voiceover (20% of progress)
      if (request.options?.includeVoiceover && request.options?.script) {
        this.updateStatus({
          stage: 'generating_voiceover',
          progress: 70,
          currentTask: 'Recording voiceover...',
          estimatedTimeRemaining: 30,
        });

        const voiceoverResult = await this.generateVoiceover(request);
        if (voiceoverResult.success && voiceoverResult.url) {
          results.voiceoverUrl = voiceoverResult.url;
          creditsUsed += voiceoverResult.creditsUsed;
        }

        this.updateStatus({
          stage: 'generating_voiceover',
          progress: 85,
          currentTask: 'Voiceover complete',
        });
      }

      // Step 4: Generate Captions (10% of progress)
      if (request.options?.includeCaptions && request.options?.script) {
        this.updateStatus({
          stage: 'generating_captions',
          progress: 88,
          currentTask: 'Generating captions...',
          estimatedTimeRemaining: 10,
        });

        const captionsResult = await this.generateCaptions(request);
        if (captionsResult.success && captionsResult.url) {
          results.captionsUrl = captionsResult.url;
        }

        this.updateStatus({
          stage: 'generating_captions',
          progress: 95,
          currentTask: 'Captions complete',
        });
      }

      // Step 5: Mix everything together (5% of progress)
      // Note: Full mixing would require server-side video processing (FFmpeg)
      // For now, we return individual components that can be combined client-side
      // or in a future mixing API endpoint

      this.updateStatus({
        stage: 'complete',
        progress: 100,
        currentTask: 'Production complete!',
      });

      const processingTime = (Date.now() - startTime) / 1000;

      return {
        success: true,
        videoUrl: results.videoUrl,
        audioUrl: results.audioUrl,
        voiceoverUrl: results.voiceoverUrl,
        captionsUrl: results.captionsUrl,
        profile: this.profile,
        creditsUsed,
        processingTime,
      };
    } catch (error) {
      this.updateStatus({
        stage: 'failed',
        progress: 0,
        currentTask: 'Production failed',
      });

      return {
        success: false,
        profile: this.profile,
        creditsUsed,
        processingTime: (Date.now() - startTime) / 1000,
        error: error instanceof Error ? error.message : 'Production failed',
      };
    }
  }

  /**
   * Generate video content
   */
  private async generateVideo(request: ProductionRequest): Promise<{
    success: boolean;
    url?: string;
    creditsUsed: number;
    error?: string;
  }> {
    const videoConfig = this.profile.video;

    // Build enhanced prompt with production quality instructions
    const enhancedPrompt = this.buildVideoPrompt(request.prompt, videoConfig);

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          projectId: request.projectId,
          sceneId: request.sceneId,
          aspectRatio: videoConfig.aspectRatio,
          duration: videoConfig.duration,
          style: videoConfig.style,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, creditsUsed: 0, error: error.error };
      }

      const data = await response.json();
      return {
        success: true,
        url: data.videoUrl,
        creditsUsed: 10, // Standard video cost
      };
    } catch (error) {
      return {
        success: false,
        creditsUsed: 0,
        error: error instanceof Error ? error.message : 'Video generation failed',
      };
    }
  }

  /**
   * Generate audio/music
   */
  private async generateAudio(request: ProductionRequest): Promise<{
    success: boolean;
    url?: string;
    creditsUsed: number;
    error?: string;
  }> {
    const audioConfig = this.profile.audio;

    // Get optimal settings based on scene context
    const optimalSettings = getOptimalAudioSettings({
      mood: request.options?.mood,
      pacing: request.options?.pacing,
      hasDialogue: request.options?.hasDialogue,
    });

    try {
      const response = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: this.buildMusicPrompt(request.prompt, { ...audioConfig, ...optimalSettings }),
          projectId: request.projectId,
          sceneId: request.sceneId,
          duration: audioConfig.duration,
          genre: optimalSettings.genre || audioConfig.genre,
          mood: optimalSettings.mood || audioConfig.mood,
          tempo: optimalSettings.tempo || audioConfig.tempo,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, creditsUsed: 0, error: error.error };
      }

      const data = await response.json();
      return {
        success: true,
        url: data.musicUrl,
        creditsUsed: 5, // Standard music cost
      };
    } catch (error) {
      return {
        success: false,
        creditsUsed: 0,
        error: error instanceof Error ? error.message : 'Music generation failed',
      };
    }
  }

  /**
   * Generate voiceover
   */
  private async generateVoiceover(request: ProductionRequest): Promise<{
    success: boolean;
    url?: string;
    creditsUsed: number;
    error?: string;
  }> {
    if (!request.options?.script) {
      return { success: false, creditsUsed: 0, error: 'No script provided' };
    }

    const voiceConfig = this.profile.voiceover;
    const optimalSettings = getOptimalVoiceoverSettings({
      contentType: request.options?.contentType,
      emotionalTone: request.options?.mood,
    });

    try {
      const response = await fetch('/api/generate-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: request.options.script,
          projectId: request.projectId,
          sceneId: request.sceneId,
          voice: optimalSettings.voice || voiceConfig.voice,
          speed: optimalSettings.speed || voiceConfig.speed,
          model: voiceConfig.model,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, creditsUsed: 0, error: error.error };
      }

      const data = await response.json();
      const charCount = request.options.script.length;
      const creditCost = Math.ceil(charCount / 1000) * 2;

      return {
        success: true,
        url: data.voiceoverUrl,
        creditsUsed: creditCost,
      };
    } catch (error) {
      return {
        success: false,
        creditsUsed: 0,
        error: error instanceof Error ? error.message : 'Voiceover generation failed',
      };
    }
  }

  /**
   * Generate captions
   */
  private async generateCaptions(request: ProductionRequest): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    if (!request.options?.script) {
      return { success: false, error: 'No script provided' };
    }

    const captionConfig = getOptimalCaptionSettings({
      platform: request.options?.targetPlatform,
    });

    // Generate SRT/VTT format captions
    const captions = this.generateCaptionFile(request.options.script, captionConfig);

    // In a full implementation, this would upload to storage
    // For now, return a data URL
    const blob = new Blob([captions], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);

    return {
      success: true,
      url,
    };
  }

  /**
   * Build enhanced video prompt
   */
  private buildVideoPrompt(basePrompt: string, config: typeof this.profile.video): string {
    const styleModifiers = [];

    // Add quality and style modifiers
    styleModifiers.push(`${config.style} style`);
    styleModifiers.push(`${config.colorGrading} color grading`);
    styleModifiers.push(`${config.motionIntensity} motion`);
    styleModifiers.push(`${config.resolution} quality`);
    styleModifiers.push(`cinematic ${config.fps}fps`);

    if (config.aspectRatio === '21:9') {
      styleModifiers.push('anamorphic widescreen');
    }

    return `${basePrompt}. ${styleModifiers.join(', ')}. Professional cinematography, high production value.`;
  }

  /**
   * Build music prompt
   */
  private buildMusicPrompt(basePrompt: string, config: Partial<typeof this.profile.audio>): string {
    const musicModifiers = [];

    if (config.genre) musicModifiers.push(config.genre);
    if (config.mood) musicModifiers.push(`${config.mood} mood`);
    if (config.tempo) musicModifiers.push(`${config.tempo} tempo`);
    if (config.includeVocals && config.vocalStyle) {
      musicModifiers.push(`with ${config.vocalStyle} vocals`);
    }

    return `${musicModifiers.join(', ')} soundtrack for: ${basePrompt}. Professional production, modern sound design.`;
  }

  /**
   * Generate caption file in VTT format
   */
  private generateCaptionFile(script: string, config: ReturnType<typeof getOptimalCaptionSettings>): string {
    const lines: string[] = ['WEBVTT', ''];

    // Split script into segments based on timing preference
    const segments = this.splitIntoSegments(script, config.timing);

    // Estimate timing (3 seconds per phrase on average)
    let currentTime = 0;
    const avgDuration = config.timing === 'word' ? 0.5 : config.timing === 'phrase' ? 3 : 5;

    segments.forEach((segment, index) => {
      const startTime = this.formatVTTTime(currentTime);
      currentTime += avgDuration;
      const endTime = this.formatVTTTime(currentTime);

      lines.push(`${index + 1}`);
      lines.push(`${startTime} --> ${endTime}`);
      lines.push(segment);
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Split text into segments
   */
  private splitIntoSegments(text: string, timing: 'word' | 'phrase' | 'sentence'): string[] {
    switch (timing) {
      case 'word':
        return text.split(/\s+/).filter(Boolean);
      case 'sentence':
        return text.split(/[.!?]+/).filter(Boolean).map(s => s.trim());
      case 'phrase':
      default:
        // Split on commas, semicolons, and sentence endings
        return text.split(/[,;.!?]+/).filter(Boolean).map(s => s.trim());
    }
  }

  /**
   * Format time for VTT
   */
  private formatVTTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default ProductionMixer;

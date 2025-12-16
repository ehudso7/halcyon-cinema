import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getProjectByIdAsync } from '@/utils/storage';
import { generateTextWithSettings } from '@/utils/openai';
import { StoryForgeFeatureId, isValidStoryForgeFeatureId } from '@/types';
import {
  AIAuthorSettings,
  GenreType,
  QualityTier,
  QUALITY_TIERS,
  GENRE_PRESETS,
  buildSystemPrompt,
  validateAISettings,
  calculateTemperature,
} from '@/config/ai-settings';

const MAX_CONTENT_LENGTH = 10000;

interface StoryForgeRequest {
  projectId: string;
  feature: string;
  content: string;
  options?: {
    mode?: 'rewrite' | 'condense' | 'continue';
  };
  authorSettings?: Partial<AIAuthorSettings>;
  genre?: GenreType;
  qualityTier?: QualityTier;
}

const featurePrompts: Record<StoryForgeFeatureId, (content: string, options?: StoryForgeRequest['options']) => string> = {
  'narrative-generation': (content) =>
    `You are a skilled storyteller. Generate a compelling narrative based on the following prompt or outline. Write in a engaging, immersive style with vivid descriptions and natural dialogue.

Prompt/Outline:
${content}

Generate the narrative:`,

  'chapter-expansion': (content) =>
    `You are a skilled novelist. Expand the following chapter outline into a full, detailed chapter. Include vivid descriptions, natural dialogue, character development, and emotional depth. Maintain consistent pacing and narrative flow.

Chapter Outline:
${content}

Expand into a full chapter:`,

  'scene-expansion': (content) =>
    `You are a skilled scene writer. Transform the following scene summary into a vivid, detailed scene. Include sensory details (sight, sound, smell, touch, taste), character interactions, emotional beats, and atmospheric descriptions.

Scene Summary:
${content}

Expand into a detailed scene:`,

  'rewrite-condense': (content, options) => {
    const mode = options?.mode || 'rewrite';
    const instructions = {
      rewrite: 'Rewrite the following content to improve flow, clarity, and engagement while preserving the core meaning and story elements. Enhance the prose quality.',
      condense: 'Condense the following content to be more concise while preserving all essential story elements, key details, and emotional impact. Remove unnecessary words and tighten the prose.',
      continue: 'Continue the following content naturally, matching the established tone, style, and narrative direction. Maintain consistency with what came before.',
    };

    return `You are a skilled editor. ${instructions[mode]}

Content:
${content}

${mode === 'continue' ? 'Continue the story:' : mode === 'condense' ? 'Condensed version:' : 'Rewritten version:'}`;
  },

  'canon-validation': (content) =>
    `You are a story consistency expert. Analyze the following content for potential inconsistencies, plot holes, or contradictions. Check for:
- Character consistency (behavior, knowledge, abilities)
- Timeline issues
- World-building contradictions
- Logical inconsistencies

Content to validate:
${content}

Provide a detailed analysis of any issues found, or confirm if the content is consistent:`,

  'ai-author-controls': () => '',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { projectId, feature, content, options, authorSettings } = req.body as StoryForgeRequest;

  if (!projectId || !feature) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate feature ID at runtime
  if (!isValidStoryForgeFeatureId(feature)) {
    return res.status(400).json({ error: 'Invalid feature type' });
  }

  // Handle AI author controls (just save settings, no AI processing)
  if (feature === 'ai-author-controls') {
    // In a full implementation, you'd save these settings to the database
    return res.status(200).json({
      success: true,
      message: 'Author settings saved',
      settings: authorSettings,
    });
  }

  if (!content?.trim()) {
    return res.status(400).json({ error: 'Content is required for this feature' });
  }

  // Validate content length
  if (content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({ error: `Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters` });
  }

  try {
    // Verify project ownership
    const project = await getProjectByIdAsync(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== session.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build the prompt
    const promptBuilder = featurePrompts[feature];
    if (!promptBuilder) {
      return res.status(400).json({ error: 'Invalid feature' });
    }

    const prompt = promptBuilder(content, options);

    // Build context from project data
    let contextInfo = '';

    if (project.lore && project.lore.length > 0) {
      const loreContext = project.lore
        .slice(0, 5)
        .map((l) => `- ${l.name}: ${l.summary || l.description?.substring(0, 200) || ''}`)
        .join('\n');
      contextInfo += `\n\nWorld Lore Context:\n${loreContext}`;
    }

    if (project.characters && project.characters.length > 0) {
      const characterContext = project.characters
        .slice(0, 5)
        .map((c) => `- ${c.name}: ${c.description?.substring(0, 150) || ''}`)
        .join('\n');
      contextInfo += `\n\nCharacter Context:\n${characterContext}`;
    }

    const fullPrompt = contextInfo ? `${prompt}\n\nProject Context:${contextInfo}` : prompt;

    // Get validated author settings
    const validatedSettings = validateAISettings(authorSettings || {});

    // Get and validate quality tier
    const { qualityTier: requestedTier, genre: requestedGenre } = req.body as StoryForgeRequest;
    const validQualityTiers: QualityTier[] = ['standard', 'professional', 'premium'];
    const tier: QualityTier = requestedTier && validQualityTiers.includes(requestedTier)
      ? requestedTier
      : 'professional';
    const qualitySettings = QUALITY_TIERS[tier];

    // Validate genre if provided
    const validatedGenre: GenreType | undefined = requestedGenre && requestedGenre in GENRE_PRESETS
      ? requestedGenre
      : undefined;

    // Calculate temperature from creativity and quality tier
    const temperature = calculateTemperature(validatedSettings.creativity, tier);

    // Build the system prompt with genre and quality settings
    const systemPrompt = buildSystemPrompt(validatedSettings, validatedGenre, tier, 'storyforge');

    // Generate the content using OpenAI with full settings
    const result = await generateTextWithSettings(fullPrompt, {
      systemPrompt,
      temperature,
      maxTokens: qualitySettings.maxTokens,
      topP: qualitySettings.topP,
      frequencyPenalty: qualitySettings.frequencyPenalty,
      presencePenalty: qualitySettings.presencePenalty,
    });

    // Credit costs by tier
    const TIER_CREDITS: Record<QualityTier, number> = { standard: 1, professional: 2, premium: 3 };

    return res.status(200).json({
      success: true,
      result,
      feature,
      genre: validatedGenre ?? null,
      qualityTier: tier,
      creditsUsed: TIER_CREDITS[tier],
    });
  } catch (error) {
    console.error('StoryForge processing error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to process content',
    });
  }
}

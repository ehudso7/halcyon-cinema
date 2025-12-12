import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { requireAuth, checkRateLimit } from '@/utils/api-auth';

/**
 * FCR (Fiction Craft Rules) + UFG (Ultimate Fiction Guidelines) Refinement API
 *
 * This endpoint implements a two-pass quality refinement system:
 * 1. FCR Pass: Applies structural and technical writing rules
 * 2. UFG Pass: Humanizes prose, ensures emotional depth, removes AI tells
 *
 * The result is professional, publishable-quality content.
 */

interface RefineRequest {
  content: string;
  contentType: 'scene' | 'character' | 'lore' | 'screenplay';
  genre?: string;
  tone?: string;
}

interface QualityAnalysis {
  passiveVoicePercent: number;
  showingVsTelling: number;
  dialogueRatio: number;
  repetitionScore: number;
  emotionalDepth: number;
  originalityScore: number;
  aiTellsRemoved: boolean;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

interface RefineResponse {
  success: boolean;
  refinedContent?: string;
  qualityAnalysis?: QualityAnalysis;
  improvements?: string[];
  error?: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// FCR Quality Standards
const FCR_STANDARDS = {
  maxPassiveVoice: 5, // percentage
  maxGlueWords: 40, // percentage
  minShowingVsTelling: 70, // percentage
  maxRepetition: 2, // percentage of repeated phrases
  dialogueToNarration: { min: 25, max: 40 }, // percentage
  dynamicToPacingRatio: { dynamic: 70, reflective: 30 },
};

// UFG Humanization Rules
const UFG_RULES = `
ULTIMATE FICTION GUIDELINES - Apply these to ensure human-grade prose:

1. VOICE & AUTHENTICITY
   - Each character must speak with distinct rhythm and vocabulary
   - Internal thoughts must feel genuine, not expository
   - Avoid perfectly articulated emotions - humans are messy

2. SENSORY IMMERSION
   - Engage at least 3 senses per scene
   - Specific details > generic descriptions
   - Environment should reflect emotional state

3. EMOTIONAL REALISM
   - Characters should have mixed, complex motivations
   - Reactions should be slightly delayed or unexpected
   - Include physical manifestations of emotion

4. PROSE ORIGINALITY
   - Replace any cliché with a fresh metaphor
   - Vary sentence length dramatically
   - Use unexpected word choices that still feel natural

5. AI TELL ELIMINATION
   - Remove: "As [name] [verb]" constructions
   - Remove: "Little did they know..."
   - Remove: Overuse of "suddenly", "very", "really"
   - Remove: Perfect parallel sentence structures
   - Remove: Characters who explain their feelings directly
   - Remove: Overly smooth transitions
   - Add: Sentence fragments for emphasis
   - Add: Interruptions in dialogue
   - Add: Contradictory character behaviors

6. SUBTEXT & LAYERS
   - What characters say ≠ what they mean
   - Include environmental storytelling
   - Plant subtle foreshadowing
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RefineResponse>
) {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  // Rate limit: 20 refinements per hour
  if (!checkRateLimit(`refine-story:${userId}`, 20, 3600000)) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. You can refine up to 20 pieces per hour.',
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`,
    });
  }

  const { content, contentType, genre, tone }: RefineRequest = req.body;

  if (!content || typeof content !== 'string' || content.trim().length < 50) {
    return res.status(400).json({
      success: false,
      error: 'Content must be at least 50 characters',
    });
  }

  if (!['scene', 'character', 'lore', 'screenplay'].includes(contentType)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid content type',
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'AI features are not configured.',
    });
  }

  try {
    // PASS 1: FCR Analysis and Structural Refinement
    const fcrPrompt = `You are a professional editor applying Fiction Craft Rules (FCR) to improve this ${contentType}.

CURRENT CONTENT:
${content}

FCR STANDARDS TO ENFORCE:
- Passive voice must be ≤${FCR_STANDARDS.maxPassiveVoice}% of sentences
- "Showing" must comprise ≥${FCR_STANDARDS.minShowingVsTelling}% of descriptions (vs telling)
- Eliminate weak verbs (is, was, were, had, have)
- Remove redundant phrases and filler words
- Ensure every sentence advances plot or reveals character
- Vary sentence rhythm: mix short punchy sentences with longer flowing ones
- Dialogue must sound natural and character-specific

${genre ? `Genre context: ${genre}` : ''}
${tone ? `Tone: ${tone}` : ''}

Rewrite the content applying all FCR standards. Maintain the same story beats but elevate the craft.

Respond with JSON:
{
  "refinedContent": "the improved content",
  "improvements": ["list of specific changes made"],
  "metrics": {
    "passiveVoicePercent": number,
    "showingVsTelling": number,
    "dialogueRatio": number,
    "repetitionScore": number
  }
}`;

    const fcrResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert fiction editor specializing in technical craft.' },
        { role: 'user', content: fcrPrompt },
      ],
      max_tokens: 3000,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const fcrResult = JSON.parse(fcrResponse.choices[0]?.message?.content || '{}');

    // PASS 2: UFG Humanization
    const ufgPrompt = `You are a master storyteller applying Ultimate Fiction Guidelines (UFG) to humanize this ${contentType}.

CONTENT AFTER FCR PASS:
${fcrResult.refinedContent || content}

${UFG_RULES}

Your task:
1. Make the prose feel like it was written by an award-winning human author
2. Add emotional complexity and subtext
3. Remove ALL detectable AI patterns
4. Inject sensory details and specific imagery
5. Ensure characters feel three-dimensional
6. Make dialogue feel interrupted, overlapping, real

The result should be indistinguishable from professional human writing.

Respond with JSON:
{
  "refinedContent": "the final humanized content",
  "improvements": ["list of humanization changes"],
  "emotionalDepth": number (0-100),
  "originalityScore": number (0-100),
  "aiTellsRemoved": boolean
}`;

    const ufgResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an elite novelist known for deeply human, original prose.' },
        { role: 'user', content: ufgPrompt },
      ],
      max_tokens: 3000,
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const ufgResult = JSON.parse(ufgResponse.choices[0]?.message?.content || '{}');

    // Combine metrics and calculate overall grade
    const qualityAnalysis: QualityAnalysis = {
      passiveVoicePercent: fcrResult.metrics?.passiveVoicePercent ?? 5,
      showingVsTelling: fcrResult.metrics?.showingVsTelling ?? 75,
      dialogueRatio: fcrResult.metrics?.dialogueRatio ?? 30,
      repetitionScore: fcrResult.metrics?.repetitionScore ?? 2,
      emotionalDepth: ufgResult.emotionalDepth ?? 80,
      originalityScore: ufgResult.originalityScore ?? 80,
      aiTellsRemoved: ufgResult.aiTellsRemoved ?? true,
      overallGrade: calculateGrade(fcrResult.metrics, ufgResult),
    };

    const allImprovements = [
      ...(fcrResult.improvements || []),
      ...(ufgResult.improvements || []),
    ];

    return res.status(200).json({
      success: true,
      refinedContent: ufgResult.refinedContent || fcrResult.refinedContent || content,
      qualityAnalysis,
      improvements: allImprovements,
    });
  } catch (error) {
    console.error('[refine-story] Error:', error);

    if (error instanceof OpenAI.APIError) {
      return res.status(502).json({
        success: false,
        error: `AI service error: ${error.message}`,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to refine content',
    });
  }
}

function calculateGrade(
  fcrMetrics: { passiveVoicePercent?: number; showingVsTelling?: number; repetitionScore?: number } | undefined,
  ufgResult: { emotionalDepth?: number; originalityScore?: number; aiTellsRemoved?: boolean }
): 'A' | 'B' | 'C' | 'D' | 'F' {
  let score = 0;

  // FCR metrics (40% of grade)
  if (fcrMetrics) {
    if ((fcrMetrics.passiveVoicePercent ?? 10) <= FCR_STANDARDS.maxPassiveVoice) score += 15;
    else if ((fcrMetrics.passiveVoicePercent ?? 10) <= 10) score += 10;

    if ((fcrMetrics.showingVsTelling ?? 60) >= FCR_STANDARDS.minShowingVsTelling) score += 15;
    else if ((fcrMetrics.showingVsTelling ?? 60) >= 60) score += 10;

    if ((fcrMetrics.repetitionScore ?? 5) <= FCR_STANDARDS.maxRepetition) score += 10;
    else if ((fcrMetrics.repetitionScore ?? 5) <= 5) score += 5;
  }

  // UFG metrics (60% of grade)
  const emotionalDepth = ufgResult.emotionalDepth ?? 70;
  const originalityScore = ufgResult.originalityScore ?? 70;

  if (emotionalDepth >= 85) score += 25;
  else if (emotionalDepth >= 70) score += 20;
  else if (emotionalDepth >= 55) score += 15;
  else score += 10;

  if (originalityScore >= 85) score += 25;
  else if (originalityScore >= 70) score += 20;
  else if (originalityScore >= 55) score += 15;
  else score += 10;

  if (ufgResult.aiTellsRemoved) score += 10;

  // Convert to letter grade
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

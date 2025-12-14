import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Categories of AI prose issues
const ISSUE_CATEGORIES = {
  transitions: 'Overused transition words',
  intensifiers: 'Generic intensifiers',
  cliches: 'Cliched phrases',
  qualifiers: 'Weak qualifiers',
  jargon: 'AI-specific jargon',
  metaphors: 'Overused metaphors',
  passive: 'Passive voice constructions',
  conclusions: 'Generic conclusions',
  adjectives: 'Overused adjectives',
} as const;

// AI prose patterns with their associated categories
const AI_PROSE_PATTERNS: Array<{ pattern: RegExp; category: keyof typeof ISSUE_CATEGORIES }> = [
  // Overly flowery transitions
  { pattern: /\b(furthermore|moreover|additionally|consequently|subsequently|hence|thus|therefore|accordingly)\b/gi, category: 'transitions' },
  // Generic intensifiers
  { pattern: /\b(truly|deeply|profoundly|incredibly|remarkably|undeniably|unquestionably)\b/gi, category: 'intensifiers' },
  // Cliche openings
  { pattern: /^(in today's|in this day and age|it is worth noting|it goes without saying|needless to say)/gim, category: 'cliches' },
  // Weak qualifiers
  { pattern: /\b(somewhat|rather|quite|fairly|relatively|approximately)\b/gi, category: 'qualifiers' },
  // AI-specific phrases
  { pattern: /\b(delve into|embark on|navigate through|foster|leverage|synergy|cutting-edge|state-of-the-art)\b/gi, category: 'jargon' },
  // Overused metaphors
  { pattern: /\b(tapestry of|fabric of|journey of|landscape of|realm of|essence of)\b/gi, category: 'metaphors' },
  // Passive voice patterns
  { pattern: /\b(it can be seen|it should be noted|it is important to|it is essential to)\b/gi, category: 'passive' },
  // Generic conclusions
  { pattern: /\b(in conclusion|to sum up|all in all|at the end of the day|when all is said and done)\b/gi, category: 'conclusions' },
  // Overused adjectives
  { pattern: /\b(myriad|plethora|vast|immense|profound|intricate|multifaceted)\b/gi, category: 'adjectives' },
  // AI-typical sentence starters (maps to transitions)
  { pattern: /^(this|these|however|additionally|furthermore|moreover|consequently)/gim, category: 'transitions' },
];

interface AnalysisResult {
  originalText: string;
  issues: Array<{
    match: string;
    index: number;
    length: number;
    category: keyof typeof ISSUE_CATEGORIES;
    suggestion?: string;
  }>;
  score: number; // 0-100, higher = more AI-like
  summary: string;
}

interface SanitizeResult {
  sanitizedText: string;
  changesCount: number;
  changes: Array<{
    original: string;
    replacement: string;
    reason: string;
  }>;
}

/**
 * Analyze text for AI prose patterns
 */
function analyzeForAIPatterns(text: string): AnalysisResult {
  const issues: AnalysisResult['issues'] = [];
  let matchCount = 0;

  // Check each pattern
  AI_PROSE_PATTERNS.forEach(({ pattern, category }) => {
    // Create new regex to avoid lastIndex state issues with global flag
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      matchCount++;
      issues.push({
        match: match[0],
        index: match.index,
        length: match[0].length,
        category,
      });
    }
  });

  // Calculate AI-likeness score
  const wordCount = text.split(/\s+/).length;
  const issueRatio = matchCount / wordCount;
  const score = Math.min(100, Math.round(issueRatio * 1000));

  // Generate summary
  let summary: string;
  if (score < 20) {
    summary = 'Text appears natural with minimal AI prose patterns.';
  } else if (score < 40) {
    summary = 'Text has some AI prose patterns that could be refined.';
  } else if (score < 60) {
    summary = 'Text shows moderate AI prose characteristics. Consider revising.';
  } else {
    summary = 'Text has significant AI prose patterns. Extensive revision recommended.';
  }

  return {
    originalText: text,
    issues,
    score,
    summary,
  };
}

/**
 * Use AI to sanitize/rewrite AI-sounding prose
 */
async function sanitizeWithAI(text: string, mode: 'subtle' | 'moderate' | 'aggressive'): Promise<SanitizeResult> {
  const intensityGuide = {
    subtle: 'Make minimal changes - only fix the most obvious AI-generated phrases while preserving the original voice.',
    moderate: 'Make reasonable improvements - fix AI phrases and improve flow while keeping the general structure.',
    aggressive: 'Extensively rewrite - transform the text to sound completely natural and human-written.',
  };

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert editor specializing in making AI-generated text sound more natural and human-written.

Your task is to rewrite text to remove AI prose patterns while maintaining the original meaning.

Intensity level: ${mode}
${intensityGuide[mode]}

Common AI prose patterns to fix:
- Overused transitions (furthermore, moreover, additionally)
- Generic intensifiers (truly, deeply, profoundly)
- Clichéd openings (in today's world, it is worth noting)
- AI jargon (delve into, leverage, synergy)
- Overused metaphors (tapestry of, fabric of)
- Passive voice (it can be seen, it should be noted)
- Weak qualifiers (somewhat, rather, quite)

Return your response as JSON with this exact structure:
{
  "sanitizedText": "the rewritten text",
  "changes": [
    {"original": "original phrase", "replacement": "new phrase", "reason": "why changed"}
  ]
}`,
      },
      {
        role: 'user',
        content: `Please sanitize the following text:\n\n${text}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 4096,
  });

  const result = JSON.parse(response.choices[0]?.message?.content || '{}');

  return {
    sanitizedText: result.sanitizedText || text,
    changesCount: result.changes?.length || 0,
    changes: result.changes || [],
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { text, mode = 'moderate', action = 'analyze' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (text.length > 50000) {
      return res.status(400).json({ error: 'Text too long. Maximum 50,000 characters.' });
    }

    const validModes = ['subtle', 'moderate', 'aggressive'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Must be: subtle, moderate, or aggressive' });
    }

    const validActions = ['analyze', 'sanitize', 'both'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be: analyze, sanitize, or both' });
    }

    // Perform analysis
    const analysis = analyzeForAIPatterns(text);

    if (action === 'analyze') {
      return res.status(200).json({
        success: true,
        analysis,
      });
    }

    // Perform sanitization
    const sanitized = await sanitizeWithAI(text, mode as 'subtle' | 'moderate' | 'aggressive');

    if (action === 'sanitize') {
      return res.status(200).json({
        success: true,
        sanitized,
      });
    }

    // Both
    return res.status(200).json({
      success: true,
      analysis,
      sanitized,
    });
  } catch (error) {
    console.error('[sanitize-prose] Error:', error);
    return res.status(500).json({
      error: 'Failed to process text',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

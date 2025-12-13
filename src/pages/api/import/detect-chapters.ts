import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

interface DetectedChapter {
  index: number;
  title: string;
  startIndex: number;
  endIndex: number;
  wordCount: number;
  preview: string;
  type: 'prologue' | 'chapter' | 'epilogue' | 'interlude' | 'part';
  partNumber?: number;
  actNumber?: number;
}

interface DetectedAct {
  number: number;
  title: string;
  startChapter: number;
  endChapter: number;
}

interface DetectionResponse {
  success: boolean;
  title?: string;
  chapters?: DetectedChapter[];
  acts?: DetectedAct[];
  totalWordCount?: number;
  error?: string;
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Common chapter patterns
const CHAPTER_PATTERNS = [
  // "Chapter 1", "Chapter One", "CHAPTER I"
  /^(?:chapter|ch\.?)\s*(?:(\d+)|([a-z]+)|([ivxlcdm]+))\s*[:\-–—]?\s*(.*)$/i,
  // "1.", "1:", "1 -"
  /^(\d{1,3})\s*[.:\-–—]\s*(.*)$/,
  // "Part One", "PART I", "Part 1"
  /^(?:part|book|volume)\s*(?:(\d+)|([a-z]+)|([ivxlcdm]+))\s*[:\-–—]?\s*(.*)$/i,
  // "Prologue", "Epilogue", "Interlude"
  /^(prologue|epilogue|interlude|preface|introduction|afterword)\s*[:\-–—]?\s*(.*)$/i,
  // "Act I", "ACT ONE"
  /^act\s*(?:(\d+)|([a-z]+)|([ivxlcdm]+))\s*[:\-–—]?\s*(.*)$/i,
  // Roman numerals only "I.", "II.", "III."
  /^([ivxlcdm]+)\s*[.:\-–—]\s*(.*)$/i,
  // All caps title lines (potential chapter markers)
  /^([A-Z][A-Z\s]{10,50})$/,
];

// Detect if a line is a chapter marker
function isChapterMarker(line: string): { isChapter: boolean; type: DetectedChapter['type']; title: string; number?: number } {
  const trimmed = line.trim();

  if (trimmed.length === 0 || trimmed.length > 100) {
    return { isChapter: false, type: 'chapter', title: '' };
  }

  for (const pattern of CHAPTER_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      // Determine type
      let type: DetectedChapter['type'] = 'chapter';
      let title = trimmed;
      let number: number | undefined;

      if (/^(prologue|preface|introduction)/i.test(trimmed)) {
        type = 'prologue';
        title = match[2] || 'Prologue';
      } else if (/^(epilogue|afterword)/i.test(trimmed)) {
        type = 'epilogue';
        title = match[2] || 'Epilogue';
      } else if (/^interlude/i.test(trimmed)) {
        type = 'interlude';
        title = match[2] || 'Interlude';
      } else if (/^(part|book|volume)/i.test(trimmed)) {
        type = 'part';
        number = parseChapterNumber(match[1] || match[2] || match[3]);
        title = match[4] || `Part ${number}`;
      } else if (/^(chapter|ch\.?)/i.test(trimmed)) {
        type = 'chapter';
        number = parseChapterNumber(match[1] || match[2] || match[3]);
        title = match[4] || `Chapter ${number}`;
      } else if (/^act/i.test(trimmed)) {
        type = 'part';
        number = parseChapterNumber(match[1] || match[2] || match[3]);
        title = match[4] || `Act ${number}`;
      } else if (/^[ivxlcdm]+\s*[.:\-–—]/i.test(trimmed)) {
        type = 'chapter';
        number = parseRomanNumeral(match[1]);
        title = match[2] || `Chapter ${number}`;
      } else if (/^\d{1,3}\s*[.:\-–—]/.test(trimmed)) {
        type = 'chapter';
        number = parseInt(match[1]);
        title = match[2] || `Chapter ${number}`;
      }

      return { isChapter: true, type, title: title.trim(), number };
    }
  }

  return { isChapter: false, type: 'chapter', title: '' };
}

function parseChapterNumber(value: string): number {
  if (!value) return 1;

  // Try numeric
  const num = parseInt(value);
  if (!isNaN(num)) return num;

  // Try roman numeral
  const roman = parseRomanNumeral(value);
  if (roman > 0) return roman;

  // Try word number
  const wordNumbers: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  };

  return wordNumbers[value.toLowerCase()] || 1;
}

function parseRomanNumeral(value: string): number {
  if (!value) return 0;

  const romanValues: Record<string, number> = {
    i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000,
  };

  let result = 0;
  const lower = value.toLowerCase();

  for (let i = 0; i < lower.length; i++) {
    const current = romanValues[lower[i]] || 0;
    const next = romanValues[lower[i + 1]] || 0;

    if (current < next) {
      result -= current;
    } else {
      result += current;
    }
  }

  return result;
}

// Rule-based chapter detection
function detectChaptersRuleBased(content: string): DetectedChapter[] {
  const lines = content.split('\n');
  const chapters: DetectedChapter[] = [];
  let currentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = currentIndex;
    currentIndex += line.length + 1; // +1 for newline

    const { isChapter, type, title, number } = isChapterMarker(line);

    if (isChapter) {
      // Close previous chapter
      if (chapters.length > 0) {
        chapters[chapters.length - 1].endIndex = lineStart - 1;
      }

      // Start new chapter
      chapters.push({
        index: chapters.length,
        title: title || `Chapter ${chapters.length + 1}`,
        startIndex: lineStart,
        endIndex: content.length,
        wordCount: 0,
        preview: '',
        type,
        partNumber: type === 'part' ? number : undefined,
      });
    }
  }

  // If no chapters detected, treat entire content as one chapter
  if (chapters.length === 0) {
    chapters.push({
      index: 0,
      title: 'Full Text',
      startIndex: 0,
      endIndex: content.length,
      wordCount: 0,
      preview: '',
      type: 'chapter',
    });
  }

  // Calculate word counts and previews
  for (const chapter of chapters) {
    const chapterContent = content.substring(chapter.startIndex, chapter.endIndex);
    chapter.wordCount = chapterContent.split(/\s+/).filter(w => w.length > 0).length;

    // Get preview (first ~200 chars of actual content, skip the title line)
    const contentLines = chapterContent.split('\n').slice(1).join('\n').trim();
    chapter.preview = contentLines.substring(0, 200).replace(/\s+/g, ' ').trim();
    if (contentLines.length > 200) {
      chapter.preview += '...';
    }
  }

  return chapters;
}

// AI-enhanced chapter detection for complex documents
async function detectChaptersAI(content: string, ruleBasedChapters: DetectedChapter[]): Promise<{
  chapters: DetectedChapter[];
  acts: DetectedAct[];
  title: string;
}> {
  if (!openai) {
    return { chapters: ruleBasedChapters, acts: [], title: 'Untitled' };
  }

  // Only use AI if rule-based detection found few chapters in a long document
  const wordCount = content.split(/\s+/).length;
  const needsAI = (ruleBasedChapters.length <= 2 && wordCount > 10000) ||
    (ruleBasedChapters.length === 1 && wordCount > 5000);

  if (!needsAI && ruleBasedChapters.length > 1) {
    // Try to detect title and acts from existing structure
    return {
      chapters: ruleBasedChapters,
      acts: detectActsFromChapters(ruleBasedChapters),
      title: inferTitle(content, ruleBasedChapters),
    };
  }

  try {
    // Send first 15000 chars for structure analysis
    const sampleContent = content.substring(0, 15000);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a document structure analyzer. Analyze the given text sample and identify:
1. The document/book title (if detectable)
2. Chapter or section boundaries
3. Any act/part structure

Return JSON:
{
  "title": "detected title or 'Untitled'",
  "hasChapters": boolean,
  "chapterPattern": "description of how chapters are marked",
  "suggestedBreakpoints": [
    { "position": approximate_character_position, "title": "chapter title", "type": "prologue|chapter|epilogue|part" }
  ],
  "acts": [
    { "number": 1, "title": "Act name", "startsAtChapter": 1, "endsAtChapter": 5 }
  ]
}`,
        },
        {
          role: 'user',
          content: `Analyze this document structure:\n\n${sampleContent}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.3,
    });

    const analysis = JSON.parse(completion.choices[0].message.content || '{}');

    // If AI found better structure, use it
    if (analysis.suggestedBreakpoints?.length > ruleBasedChapters.length) {
      const aiChapters: DetectedChapter[] = analysis.suggestedBreakpoints.map(
        (bp: { position: number; title: string; type: string }, index: number) => {
          const startIndex = bp.position;
          const endIndex = analysis.suggestedBreakpoints[index + 1]?.position || content.length;
          const chapterContent = content.substring(startIndex, endIndex);

          return {
            index,
            title: bp.title,
            startIndex,
            endIndex,
            wordCount: chapterContent.split(/\s+/).filter((w: string) => w.length > 0).length,
            preview: chapterContent.substring(0, 200).replace(/\s+/g, ' ').trim() + '...',
            type: bp.type || 'chapter',
          };
        }
      );

      return {
        chapters: aiChapters,
        acts: analysis.acts || [],
        title: analysis.title || 'Untitled',
      };
    }

    return {
      chapters: ruleBasedChapters,
      acts: analysis.acts || detectActsFromChapters(ruleBasedChapters),
      title: analysis.title || inferTitle(content, ruleBasedChapters),
    };
  } catch (error) {
    console.error('[detect-chapters] AI analysis failed:', error);
    return {
      chapters: ruleBasedChapters,
      acts: detectActsFromChapters(ruleBasedChapters),
      title: inferTitle(content, ruleBasedChapters),
    };
  }
}

function detectActsFromChapters(chapters: DetectedChapter[]): DetectedAct[] {
  const acts: DetectedAct[] = [];
  let currentAct = 1;
  let actStart = 0;

  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].type === 'part') {
      if (i > 0) {
        acts.push({
          number: currentAct,
          title: `Act ${currentAct}`,
          startChapter: actStart,
          endChapter: i - 1,
        });
      }
      currentAct++;
      actStart = i;
    }
  }

  // Close final act
  if (chapters.length > 0) {
    acts.push({
      number: currentAct,
      title: `Act ${currentAct}`,
      startChapter: actStart,
      endChapter: chapters.length - 1,
    });
  }

  return acts.length > 1 ? acts : [];
}

function inferTitle(content: string, chapters: DetectedChapter[]): string {
  // Check if first chapter is a title page
  if (chapters.length > 0 && chapters[0].wordCount < 100) {
    const firstContent = content.substring(chapters[0].startIndex, chapters[0].endIndex);
    const lines = firstContent.split('\n').filter(l => l.trim().length > 0);
    if (lines.length > 0 && lines[0].length < 100) {
      return lines[0].trim();
    }
  }

  // Look for title-like content at the start
  const firstLines = content.split('\n').slice(0, 10);
  for (const line of firstLines) {
    const trimmed = line.trim();
    if (trimmed.length > 5 && trimmed.length < 80 && !isChapterMarker(trimmed).isChapter) {
      // Likely a title
      return trimmed;
    }
  }

  return 'Untitled';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DetectionResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { content } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ success: false, error: 'Content is required' });
  }

  if (content.length < 500) {
    return res.status(400).json({ success: false, error: 'Content too short for chapter detection' });
  }

  try {
    // First, do rule-based detection
    const ruleBasedChapters = detectChaptersRuleBased(content);

    // Then enhance with AI if needed
    const { chapters, acts, title } = await detectChaptersAI(content, ruleBasedChapters);

    const totalWordCount = content.split(/\s+/).filter(w => w.length > 0).length;

    console.log(`[detect-chapters] Found ${chapters.length} chapters, ${acts.length} acts, ${totalWordCount} words`);

    return res.status(200).json({
      success: true,
      title,
      chapters,
      acts,
      totalWordCount,
    });
  } catch (error) {
    console.error('[detect-chapters] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect chapters',
    });
  }
}

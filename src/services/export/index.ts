/**
 * Export Service
 *
 * This service handles exporting literary works to various publishing-ready formats:
 * - PDF: Professional manuscript format
 * - DOCX: Microsoft Word compatible
 * - EPUB: E-book format
 * - Fountain: Screenplay format
 * - Markdown: Universal text format
 * - HTML: Web-ready format
 *
 * IMPORTANT: Export features are available based on subscription tier.
 * Basic exports (PDF, Markdown) are available to all tiers.
 */

import { SubscriptionTier, hasFeatureAccess, TIER_FEATURES } from '@/config/feature-flags';
import { dbGetProjectChapters, dbGetChapterScenes } from '@/utils/db-literary';
import { dbGetProjectById } from '@/utils/db';
import type {
  ExportFormat,
  ExportConfig,
  ExportResult,
  Chapter,
  ChapterScene,
} from '@/types/literary';

// ============================================================================
// Types
// ============================================================================

export interface ExportContext {
  userId: string;
  projectId: string;
  tier: SubscriptionTier;
}

export interface ExportError {
  code: 'FEATURE_DISABLED' | 'INSUFFICIENT_TIER' | 'EXPORT_FAILED' | 'PROJECT_NOT_FOUND';
  message: string;
  details?: unknown;
}

// ============================================================================
// Feature Access
// ============================================================================

/**
 * Check if a user can export to a specific format.
 */
export function canExportFormat(tier: SubscriptionTier, format: ExportFormat): boolean {
  const formatKey = format as keyof typeof TIER_FEATURES.starter.exports;
  return hasFeatureAccess(tier, `exports.${formatKey}`);
}

/**
 * Get all available export formats for a tier.
 */
export function getAvailableFormats(tier: SubscriptionTier): ExportFormat[] {
  const formats: ExportFormat[] = [];
  const exports = TIER_FEATURES[tier].exports;

  if (exports.pdf) formats.push('pdf');
  if (exports.docx) formats.push('docx');
  if (exports.epub) formats.push('epub');
  if (exports.fountain) formats.push('fountain');
  if (exports.markdown) formats.push('markdown');
  formats.push('html'); // HTML is always available
  formats.push('txt'); // TXT is always available

  return formats;
}

// ============================================================================
// Export Service
// ============================================================================

/**
 * Export Service Adapter
 *
 * Provides the public API for exporting literary works.
 */
export class ExportAdapter {
  private context: ExportContext;

  constructor(context: ExportContext) {
    this.context = context;
  }

  /**
   * Check if export is available for the current context.
   */
  canExport(format: ExportFormat): boolean {
    return canExportFormat(this.context.tier, format);
  }

  /**
   * Get all available export formats.
   */
  getAvailableFormats(): ExportFormat[] {
    return getAvailableFormats(this.context.tier);
  }

  /**
   * Export a project to a specific format.
   */
  async export(config: ExportConfig): Promise<ExportResult> {
    // Check format access
    if (!this.canExport(config.format)) {
      return {
        success: false,
        format: config.format,
        error: `Export to ${config.format.toUpperCase()} requires a higher subscription tier`,
        createdAt: new Date().toISOString(),
      };
    }

    // Get project
    const project = await dbGetProjectById(this.context.projectId);
    if (!project) {
      return {
        success: false,
        format: config.format,
        error: 'Project not found',
        createdAt: new Date().toISOString(),
      };
    }

    // Get chapters with scenes
    const chapters = await this.getChaptersWithScenes();

    // Filter chapters if specific ones requested
    const chaptersToExport = config.includeChapters === 'all'
      ? chapters
      : chapters.filter(c => (config.includeChapters as string[]).includes(c.id));

    // Generate export based on format
    switch (config.format) {
      case 'pdf':
        return this.exportToPdf(project, chaptersToExport, config);
      case 'docx':
        return this.exportToDocx(project, chaptersToExport, config);
      case 'epub':
        return this.exportToEpub(project, chaptersToExport, config);
      case 'fountain':
        return this.exportToFountain(project, chaptersToExport, config);
      case 'markdown':
        return this.exportToMarkdown(project, chaptersToExport, config);
      case 'html':
        return this.exportToHtml(project, chaptersToExport, config);
      case 'txt':
        return this.exportToTxt(project, chaptersToExport, config);
      default:
        return {
          success: false,
          format: config.format,
          error: `Unsupported format: ${config.format}`,
          createdAt: new Date().toISOString(),
        };
    }
  }

  /**
   * Get chapters with their scenes.
   */
  private async getChaptersWithScenes(): Promise<Array<Chapter & { scenes: ChapterScene[] }>> {
    const chapters = await dbGetProjectChapters(this.context.projectId);
    const chaptersWithScenes = await Promise.all(
      chapters.map(async (chapter) => {
        const scenes = await dbGetChapterScenes(chapter.id);
        return { ...chapter, scenes };
      })
    );
    return chaptersWithScenes;
  }

  // ==========================================================================
  // Format-Specific Export Methods
  // ==========================================================================

  /**
   * Export to PDF format (manuscript style).
   * Returns HTML content that can be converted to PDF client-side or by print dialog.
   */
  private async exportToPdf(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    config: ExportConfig
  ): Promise<ExportResult> {
    // Generate PDF-ready HTML content with print styling
    const content = this.generatePdfHtmlContent(project, chapters, config);
    const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}.html`;

    return {
      success: true,
      format: 'pdf',
      fileName,
      fileSize: content.length,
      content,
      mimeType: 'text/html',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Export to DOCX format.
   * Generates RTF content which is widely compatible with Word and other editors.
   * RTF is used instead of DOCX XML as it requires no external libraries.
   */
  private async exportToDocx(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    config: ExportConfig
  ): Promise<ExportResult> {
    // Generate RTF content (widely compatible with Word)
    const content = this.generateRtfContent(project, chapters, config);
    const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}.rtf`;

    return {
      success: true,
      format: 'docx',
      fileName,
      fileSize: content.length,
      content,
      mimeType: 'application/rtf',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Export to EPUB format.
   * Returns HTML content that can be packaged into EPUB or used directly.
   */
  private async exportToEpub(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    config: ExportConfig
  ): Promise<ExportResult> {
    // Generate EPUB-compatible HTML content
    const content = this.generateEpubHtmlContent(project, chapters, config);
    const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}_ebook.html`;

    return {
      success: true,
      format: 'epub',
      fileName,
      fileSize: content.length,
      content,
      mimeType: 'text/html',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Export to Fountain format (screenplays).
   */
  private async exportToFountain(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    _config: ExportConfig
  ): Promise<ExportResult> {
    const content = this.generateFountainContent(project, chapters);
    const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}.fountain`;

    return {
      success: true,
      format: 'fountain',
      fileName,
      fileSize: content.length,
      content,
      mimeType: 'text/plain',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Export to Markdown format.
   */
  private async exportToMarkdown(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    config: ExportConfig
  ): Promise<ExportResult> {
    const content = this.generateMarkdownContent(project, chapters, config);
    const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}.md`;

    return {
      success: true,
      format: 'markdown',
      fileName,
      fileSize: content.length,
      content,
      mimeType: 'text/markdown',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Export to HTML format.
   */
  private async exportToHtml(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    config: ExportConfig
  ): Promise<ExportResult> {
    const content = this.generateHtmlContent(project, chapters, config);
    const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}.html`;

    return {
      success: true,
      format: 'html',
      fileName,
      fileSize: content.length,
      content,
      mimeType: 'text/html',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Export to plain text format.
   */
  private async exportToTxt(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    _config: ExportConfig
  ): Promise<ExportResult> {
    const content = this.generatePlainTextContent(project, chapters);
    const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}.txt`;

    return {
      success: true,
      format: 'txt',
      fileName,
      fileSize: content.length,
      content,
      mimeType: 'text/plain',
      createdAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Content Generators
  // ==========================================================================

  /**
   * Generate manuscript-style content.
   */
  private generateManuscriptContent(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    config: ExportConfig
  ): string {
    const lines: string[] = [];

    // Title page
    if (config.includeTitlePage) {
      lines.push('');
      lines.push('');
      lines.push('');
      lines.push(project.name.toUpperCase());
      lines.push('');
      if (project.description) {
        lines.push(project.description);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Table of contents
    if (config.includeTableOfContents) {
      lines.push('TABLE OF CONTENTS');
      lines.push('');
      chapters.forEach((chapter, index) => {
        lines.push(`${index + 1}. ${chapter.title}`);
      });
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Chapters
    chapters.forEach((chapter) => {
      lines.push(`CHAPTER ${chapter.number}`);
      lines.push(chapter.title.toUpperCase());
      lines.push('');

      if (chapter.content) {
        lines.push(chapter.content);
      }

      // Include scenes
      chapter.scenes.forEach((scene) => {
        if (scene.content) {
          lines.push('');
          lines.push(scene.content);
        }
      });

      lines.push('');
      lines.push('* * *');
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Generate Markdown content.
   */
  private generateMarkdownContent(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    config: ExportConfig
  ): string {
    const lines: string[] = [];

    // Title
    if (config.includeTitlePage) {
      lines.push(`# ${project.name}`);
      lines.push('');
      if (project.description) {
        lines.push(`*${project.description}*`);
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }

    // Table of contents
    if (config.includeTableOfContents) {
      lines.push('## Table of Contents');
      lines.push('');
      chapters.forEach((chapter, index) => {
        const anchor = chapter.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        lines.push(`${index + 1}. [${chapter.title}](#${anchor})`);
      });
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Chapters
    chapters.forEach((chapter) => {
      lines.push(`## Chapter ${chapter.number}: ${chapter.title}`);
      lines.push('');

      if (chapter.content) {
        lines.push(chapter.content);
        lines.push('');
      }

      // Include scenes
      chapter.scenes.forEach((scene) => {
        if (scene.title) {
          lines.push(`### ${scene.title}`);
          lines.push('');
        }
        if (scene.content) {
          lines.push(scene.content);
          lines.push('');
        }
      });

      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Generate HTML content.
   */
  private generateHtmlContent(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    config: ExportConfig
  ): string {
    const lines: string[] = [];

    lines.push('<!DOCTYPE html>');
    lines.push('<html lang="en">');
    lines.push('<head>');
    lines.push(`  <meta charset="UTF-8">`);
    lines.push(`  <meta name="viewport" content="width=device-width, initial-scale=1.0">`);
    lines.push(`  <title>${escapeHtml(project.name)}</title>`);
    lines.push('  <style>');
    lines.push('    body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }');
    lines.push('    h1 { text-align: center; }');
    lines.push('    h2 { margin-top: 2em; border-bottom: 1px solid #ccc; padding-bottom: 0.5em; }');
    lines.push('    .chapter-content { text-indent: 2em; }');
    lines.push('    .scene-break { text-align: center; margin: 2em 0; }');
    lines.push('    .toc { margin: 2em 0; padding: 1em; background: #f5f5f5; }');
    lines.push('    .toc ul { list-style-type: none; padding-left: 0; }');
    lines.push('    .toc li { margin: 0.5em 0; }');
    lines.push('  </style>');
    lines.push('</head>');
    lines.push('<body>');

    // Title page
    if (config.includeTitlePage) {
      lines.push(`  <h1>${escapeHtml(project.name)}</h1>`);
      if (project.description) {
        lines.push(`  <p style="text-align: center; font-style: italic;">${escapeHtml(project.description)}</p>`);
      }
      lines.push('  <hr>');
    }

    // Table of contents
    if (config.includeTableOfContents) {
      lines.push('  <div class="toc">');
      lines.push('    <h2>Table of Contents</h2>');
      lines.push('    <ul>');
      chapters.forEach((chapter, index) => {
        const anchor = `chapter-${chapter.number}`;
        lines.push(`      <li><a href="#${anchor}">${index + 1}. ${escapeHtml(chapter.title)}</a></li>`);
      });
      lines.push('    </ul>');
      lines.push('  </div>');
    }

    // Chapters
    chapters.forEach((chapter) => {
      const anchor = `chapter-${chapter.number}`;
      lines.push(`  <h2 id="${anchor}">Chapter ${chapter.number}: ${escapeHtml(chapter.title)}</h2>`);

      if (chapter.content) {
        const paragraphs = chapter.content.split('\n\n');
        paragraphs.forEach((p) => {
          if (p.trim()) {
            lines.push(`  <p class="chapter-content">${escapeHtml(p.trim())}</p>`);
          }
        });
      }

      // Include scenes
      chapter.scenes.forEach((scene, index) => {
        if (index > 0 || chapter.content) {
          lines.push('  <div class="scene-break">* * *</div>');
        }
        if (scene.title) {
          lines.push(`  <h3>${escapeHtml(scene.title)}</h3>`);
        }
        if (scene.content) {
          const paragraphs = scene.content.split('\n\n');
          paragraphs.forEach((p) => {
            if (p.trim()) {
              lines.push(`  <p class="chapter-content">${escapeHtml(p.trim())}</p>`);
            }
          });
        }
      });
    });

    lines.push('</body>');
    lines.push('</html>');

    return lines.join('\n');
  }

  /**
   * Generate Fountain (screenplay) content.
   * Fountain is a plain text markup language for screenwriting.
   * @see https://fountain.io/syntax
   */
  private generateFountainContent(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>
  ): string {
    const lines: string[] = [];

    // Title page (Fountain title page syntax)
    lines.push(`Title: ${project.name}`);
    lines.push(`Credit: Written by`);
    lines.push(`Author: [Author Name]`);
    lines.push(`Draft date: ${new Date().toLocaleDateString()}`);
    if (project.description) {
      lines.push(`Notes: ${project.description}`);
    }
    lines.push('');
    lines.push('===');
    lines.push('');

    let sceneNumber = 1;

    // Process chapters as sequences/acts
    chapters.forEach((chapter, chapterIndex) => {
      // Add act break for chapters after the first
      if (chapterIndex > 0) {
        lines.push('');
        lines.push(`= ${chapter.title.toUpperCase()} =`);
        lines.push('');
      }

      // Process main chapter content
      if (chapter.content) {
        const parsedContent = this.parseContentForFountain(chapter.content, sceneNumber);
        lines.push(...parsedContent.lines);
        sceneNumber = parsedContent.sceneNumber;
      }

      // Process scenes within chapters
      chapter.scenes.forEach((scene) => {
        if (scene.content) {
          const parsedScene = this.parseContentForFountain(scene.content, sceneNumber, scene.title);
          lines.push(...parsedScene.lines);
          sceneNumber = parsedScene.sceneNumber;
        }
      });
    });

    // Add end of screenplay
    lines.push('');
    lines.push('FADE OUT.');
    lines.push('');
    lines.push('THE END');

    return lines.join('\n');
  }

  /**
   * Parse prose content and convert to Fountain screenplay format.
   * Detects dialogue patterns, scene changes, and action descriptions.
   */
  private parseContentForFountain(
    content: string,
    startingSceneNumber: number,
    sceneTitle?: string
  ): { lines: string[]; sceneNumber: number } {
    const lines: string[] = [];
    let sceneNumber = startingSceneNumber;
    let needsSceneHeading = true;

    // Split content into paragraphs
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());

    paragraphs.forEach((paragraph, index) => {
      const trimmed = paragraph.trim();

      // Skip empty paragraphs
      if (!trimmed) return;

      // Check if this looks like a scene heading already
      if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(trimmed)) {
        lines.push('');
        lines.push(trimmed.toUpperCase());
        lines.push('');
        needsSceneHeading = false;
        sceneNumber++;
        return;
      }

      // Add scene heading if this is the first content paragraph
      if (needsSceneHeading && index === 0) {
        const heading = this.generateSceneHeading(sceneTitle || trimmed, sceneNumber);
        lines.push('');
        lines.push(heading);
        lines.push('');
        needsSceneHeading = false;
        sceneNumber++;
      }

      // Detect dialogue patterns: "Character Name said/says/spoke" or quoted speech
      const dialogueMatch = this.parseDialogue(trimmed);
      if (dialogueMatch) {
        lines.push('');
        lines.push(dialogueMatch.character.toUpperCase());
        if (dialogueMatch.parenthetical) {
          lines.push(`(${dialogueMatch.parenthetical})`);
        }
        lines.push(dialogueMatch.dialogue);
        lines.push('');
        return;
      }

      // Check for transitions
      if (/^(CUT TO:|FADE TO:|DISSOLVE TO:|SMASH CUT TO:|TIME CUT:|MATCH CUT:)/i.test(trimmed)) {
        lines.push('');
        lines.push(`> ${trimmed.toUpperCase()}`);
        lines.push('');
        return;
      }

      // Otherwise treat as action/description
      lines.push('');
      lines.push(this.formatAsAction(trimmed));
    });

    return { lines, sceneNumber };
  }

  /**
   * Generate a proper screenplay scene heading.
   */
  private generateSceneHeading(titleOrContent: string, sceneNumber: number): string {
    // Try to extract location and time from the title/content
    const title = titleOrContent.substring(0, 100); // Use first 100 chars for analysis

    // Check for interior/exterior indicators
    let prefix = 'INT.';
    if (/\b(outside|outdoor|street|forest|sky|beach|field|garden|park|road|highway)\b/i.test(title)) {
      prefix = 'EXT.';
    }

    // Check for time of day indicators
    let timeOfDay = 'DAY';
    if (/\b(night|midnight|evening|dusk|dark)\b/i.test(title)) {
      timeOfDay = 'NIGHT';
    } else if (/\b(dawn|sunrise|morning)\b/i.test(title)) {
      timeOfDay = 'DAWN';
    } else if (/\b(sunset|twilight)\b/i.test(title)) {
      timeOfDay = 'DUSK';
    }

    // Extract location name from title or generate one
    let location = titleOrContent
      .replace(/[^\w\s-]/g, '')
      .split(/\s+/)
      .slice(0, 4)
      .join(' ')
      .toUpperCase();

    if (location.length < 3) {
      location = `SCENE ${sceneNumber}`;
    }

    return `${prefix} ${location} - ${timeOfDay}`;
  }

  /**
   * Parse a paragraph for dialogue patterns.
   */
  private parseDialogue(paragraph: string): {
    character: string;
    dialogue: string;
    parenthetical?: string;
  } | null {
    // Pattern 1: "dialogue," Character said/replied/exclaimed
    const pattern1 = /^[""](.+?)[""],?\s+(\w+)\s+(said|replied|exclaimed|asked|whispered|shouted|muttered|continued|added|answered)/i;
    const match1 = paragraph.match(pattern1);
    if (match1) {
      return {
        character: match1[2],
        dialogue: match1[1],
      };
    }

    // Pattern 2: Character said/replied, "dialogue"
    const pattern2 = /^(\w+)\s+(said|replied|exclaimed|asked|whispered|shouted|muttered),?\s+[""](.+?)[""]\.?$/i;
    const match2 = paragraph.match(pattern2);
    if (match2) {
      const parenthetical = this.getParentheticalFromVerb(match2[2]);
      return {
        character: match2[1],
        dialogue: match2[3],
        parenthetical,
      };
    }

    // Pattern 3: Direct quote with attribution at the end
    const pattern3 = /^[""](.+?)[""],?\s+(\w+)\s/i;
    const match3 = paragraph.match(pattern3);
    if (match3 && match3[1].length < 500) {
      return {
        character: match3[2],
        dialogue: match3[1],
      };
    }

    return null;
  }

  /**
   * Get parenthetical from dialogue verb.
   */
  private getParentheticalFromVerb(verb: string): string | undefined {
    const verbMap: Record<string, string> = {
      whispered: 'whispering',
      shouted: 'shouting',
      muttered: 'muttering',
      exclaimed: 'excited',
    };
    return verbMap[verb.toLowerCase()];
  }

  /**
   * Format text as screenplay action.
   */
  private formatAsAction(text: string): string {
    // Wrap long lines at ~60 characters for screenplay format
    const words = text.split(/\s+/);
    const actionLines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + ' ' + word).length > 60) {
        actionLines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      }
    });

    if (currentLine) {
      actionLines.push(currentLine.trim());
    }

    return actionLines.join('\n');
  }

  /**
   * Generate plain text content.
   */
  private generatePlainTextContent(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>
  ): string {
    const lines: string[] = [];

    lines.push(project.name);
    lines.push('='.repeat(project.name.length));
    lines.push('');

    if (project.description) {
      lines.push(project.description);
      lines.push('');
    }

    chapters.forEach((chapter) => {
      lines.push(`Chapter ${chapter.number}: ${chapter.title}`);
      lines.push('-'.repeat(50));
      lines.push('');

      if (chapter.content) {
        lines.push(chapter.content);
        lines.push('');
      }

      chapter.scenes.forEach((scene) => {
        if (scene.title) {
          lines.push(`--- ${scene.title} ---`);
          lines.push('');
        }
        if (scene.content) {
          lines.push(scene.content);
          lines.push('');
        }
      });

      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Generate PDF-ready HTML with print-optimized styling.
   */
  private generatePdfHtmlContent(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    config: ExportConfig
  ): string {
    const lines: string[] = [];

    lines.push('<!DOCTYPE html>');
    lines.push('<html lang="en">');
    lines.push('<head>');
    lines.push('  <meta charset="UTF-8">');
    lines.push(`  <title>${escapeHtml(project.name)}</title>`);
    lines.push('  <style>');
    lines.push('    @page { size: letter; margin: 1in; }');
    lines.push('    @media print { body { -webkit-print-color-adjust: exact; } }');
    lines.push('    body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 2; max-width: 8.5in; margin: 0 auto; padding: 1in; }');
    lines.push('    h1 { text-align: center; font-size: 24pt; margin-top: 3in; page-break-after: always; }');
    lines.push('    h2 { text-align: center; font-size: 14pt; margin-top: 2em; page-break-before: always; }');
    lines.push('    p { text-indent: 0.5in; margin: 0; }');
    lines.push('    .chapter-title { text-transform: uppercase; margin-bottom: 2em; }');
    lines.push('    .scene-break { text-align: center; margin: 2em 0; }');
    lines.push('    .toc { margin: 2em 0; }');
    lines.push('    .toc-entry { margin: 0.5em 0; }');
    lines.push('    .page-number { text-align: center; font-size: 10pt; }');
    lines.push('  </style>');
    lines.push('</head>');
    lines.push('<body>');

    // Title page
    if (config.includeTitlePage) {
      lines.push(`  <h1>${escapeHtml(project.name)}</h1>`);
      if (project.description) {
        lines.push(`  <p style="text-align: center; font-style: italic; text-indent: 0;">${escapeHtml(project.description)}</p>`);
      }
    }

    // Table of contents
    if (config.includeTableOfContents && chapters.length > 0) {
      lines.push('  <div class="toc" style="page-break-after: always;">');
      lines.push('    <h2 style="page-break-before: avoid;">TABLE OF CONTENTS</h2>');
      chapters.forEach((chapter, index) => {
        lines.push(`    <div class="toc-entry">${index + 1}. ${escapeHtml(chapter.title)}</div>`);
      });
      lines.push('  </div>');
    }

    // Chapters
    chapters.forEach((chapter) => {
      lines.push(`  <h2 class="chapter-title">CHAPTER ${chapter.number}<br>${escapeHtml(chapter.title)}</h2>`);

      if (chapter.content) {
        const paragraphs = chapter.content.split('\n\n');
        paragraphs.forEach((p) => {
          if (p.trim()) {
            lines.push(`  <p>${escapeHtml(p.trim())}</p>`);
          }
        });
      }

      chapter.scenes.forEach((scene, index) => {
        if (index > 0 || chapter.content) {
          lines.push('  <div class="scene-break">* * *</div>');
        }
        if (scene.content) {
          const paragraphs = scene.content.split('\n\n');
          paragraphs.forEach((p) => {
            if (p.trim()) {
              lines.push(`  <p>${escapeHtml(p.trim())}</p>`);
            }
          });
        }
      });
    });

    lines.push('</body>');
    lines.push('</html>');

    return lines.join('\n');
  }

  /**
   * Generate RTF content for Word-compatible export.
   * RTF (Rich Text Format) is universally supported by word processors.
   */
  private generateRtfContent(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    config: ExportConfig
  ): string {
    const lines: string[] = [];

    // RTF header
    lines.push('{\\rtf1\\ansi\\deff0');
    lines.push('{\\fonttbl{\\f0\\froman Times New Roman;}}');
    lines.push('\\paperw12240\\paperh15840'); // Letter size
    lines.push('\\margl1440\\margr1440\\margt1440\\margb1440'); // 1 inch margins
    lines.push('\\fs24'); // 12pt font

    // Title page
    if (config.includeTitlePage) {
      lines.push('\\pard\\qc\\sb4320'); // Center, space before
      lines.push(`\\fs48\\b ${escapeRtf(project.name)}\\b0\\fs24`);
      lines.push('\\par\\par');
      if (project.description) {
        lines.push(`\\i ${escapeRtf(project.description)}\\i0`);
      }
      lines.push('\\page');
    }

    // Table of contents
    if (config.includeTableOfContents && chapters.length > 0) {
      lines.push('\\pard\\qc\\sb720');
      lines.push('\\fs28\\b TABLE OF CONTENTS\\b0\\fs24');
      lines.push('\\par\\par');
      lines.push('\\pard\\ql');
      chapters.forEach((chapter, index) => {
        lines.push(`${index + 1}. ${escapeRtf(chapter.title)}\\par`);
      });
      lines.push('\\page');
    }

    // Chapters
    chapters.forEach((chapter) => {
      // Chapter heading
      lines.push('\\pard\\qc\\sb720');
      lines.push(`\\fs28\\b CHAPTER ${chapter.number}\\par`);
      lines.push(`${escapeRtf(chapter.title.toUpperCase())}\\b0\\fs24`);
      lines.push('\\par\\par');
      lines.push('\\pard\\ql\\fi720\\sl480\\slmult1'); // Indent, double space

      // Chapter content
      if (chapter.content) {
        const paragraphs = chapter.content.split('\n\n');
        paragraphs.forEach((p) => {
          if (p.trim()) {
            lines.push(`${escapeRtf(p.trim())}\\par\\par`);
          }
        });
      }

      // Scenes
      chapter.scenes.forEach((scene, index) => {
        if (index > 0 || chapter.content) {
          lines.push('\\pard\\qc\\par * * *\\par\\par');
          lines.push('\\pard\\ql\\fi720\\sl480\\slmult1');
        }
        if (scene.content) {
          const paragraphs = scene.content.split('\n\n');
          paragraphs.forEach((p) => {
            if (p.trim()) {
              lines.push(`${escapeRtf(p.trim())}\\par\\par`);
            }
          });
        }
      });

      lines.push('\\page');
    });

    lines.push('}'); // Close RTF

    return lines.join('\n');
  }

  /**
   * Generate EPUB-compatible HTML with e-reader optimized styling.
   */
  private generateEpubHtmlContent(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    config: ExportConfig
  ): string {
    const lines: string[] = [];

    lines.push('<!DOCTYPE html>');
    lines.push('<html xmlns="http://www.w3.org/1999/xhtml" lang="en">');
    lines.push('<head>');
    lines.push('  <meta charset="UTF-8" />');
    lines.push(`  <title>${escapeHtml(project.name)}</title>`);
    lines.push('  <style type="text/css">');
    lines.push('    body { font-family: serif; font-size: 1em; line-height: 1.5; margin: 1em; }');
    lines.push('    h1 { text-align: center; font-size: 2em; margin: 2em 0; }');
    lines.push('    h2 { text-align: center; font-size: 1.5em; margin: 2em 0 1em 0; }');
    lines.push('    p { text-indent: 1.5em; margin: 0; }');
    lines.push('    .title-page { text-align: center; margin: 20% 0; }');
    lines.push('    .scene-break { text-align: center; margin: 1.5em 0; }');
    lines.push('    .chapter { page-break-before: always; }');
    lines.push('    .toc { margin: 2em 0; }');
    lines.push('    .toc a { text-decoration: none; color: inherit; }');
    lines.push('    .toc-entry { margin: 0.5em 0; }');
    lines.push('  </style>');
    lines.push('</head>');
    lines.push('<body>');

    // Title page
    if (config.includeTitlePage) {
      lines.push('  <div class="title-page">');
      lines.push(`    <h1>${escapeHtml(project.name)}</h1>`);
      if (project.description) {
        lines.push(`    <p style="text-indent: 0; font-style: italic;">${escapeHtml(project.description)}</p>`);
      }
      lines.push('  </div>');
    }

    // Table of contents
    if (config.includeTableOfContents && chapters.length > 0) {
      lines.push('  <nav class="toc">');
      lines.push('    <h2>Contents</h2>');
      chapters.forEach((chapter) => {
        const anchor = `chapter-${chapter.number}`;
        lines.push(`    <div class="toc-entry"><a href="#${anchor}">Chapter ${chapter.number}: ${escapeHtml(chapter.title)}</a></div>`);
      });
      lines.push('  </nav>');
    }

    // Chapters
    chapters.forEach((chapter) => {
      const anchor = `chapter-${chapter.number}`;
      lines.push(`  <section class="chapter" id="${anchor}">`);
      lines.push(`    <h2>Chapter ${chapter.number}: ${escapeHtml(chapter.title)}</h2>`);

      if (chapter.content) {
        const paragraphs = chapter.content.split('\n\n');
        paragraphs.forEach((p) => {
          if (p.trim()) {
            lines.push(`    <p>${escapeHtml(p.trim())}</p>`);
          }
        });
      }

      chapter.scenes.forEach((scene, index) => {
        if (index > 0 || chapter.content) {
          lines.push('    <div class="scene-break">* * *</div>');
        }
        if (scene.content) {
          const paragraphs = scene.content.split('\n\n');
          paragraphs.forEach((p) => {
            if (p.trim()) {
              lines.push(`    <p>${escapeHtml(p.trim())}</p>`);
            }
          });
        }
      });

      lines.push('  </section>');
    });

    lines.push('</body>');
    lines.push('</html>');

    return lines.join('\n');
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape special characters for RTF format.
 */
function escapeRtf(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\par ');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an Export adapter for a user context.
 */
export function createExportAdapter(context: ExportContext): ExportAdapter {
  return new ExportAdapter(context);
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  ExportFormat,
  ExportConfig,
  ExportResult,
};

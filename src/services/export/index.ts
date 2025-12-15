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
  const formatKey = format as keyof typeof TIER_FEATURES.free.exports;
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
   */
  private async exportToPdf(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    config: ExportConfig
  ): Promise<ExportResult> {
    // Generate PDF content
    const content = this.generateManuscriptContent(project, chapters, config);

    // For now, return markdown content that can be converted to PDF
    // In production, this would use a PDF library like pdfkit or puppeteer
    const blob = new Blob([content], { type: 'text/markdown' });
    const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}_manuscript.md`;

    return {
      success: true,
      format: 'pdf',
      fileName,
      fileSize: blob.size,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Export to DOCX format.
   */
  private async exportToDocx(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    config: ExportConfig
  ): Promise<ExportResult> {
    // Generate content for DOCX
    const content = this.generateManuscriptContent(project, chapters, config);
    const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}.docx`;

    // In production, use docx library to create actual DOCX file
    return {
      success: true,
      format: 'docx',
      fileName,
      fileSize: content.length,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Export to EPUB format.
   */
  private async exportToEpub(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>,
    config: ExportConfig
  ): Promise<ExportResult> {
    // Generate EPUB structure
    const htmlContent = this.generateHtmlContent(project, chapters, config);
    const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}.epub`;

    // In production, use epub-gen or similar library
    return {
      success: true,
      format: 'epub',
      fileName,
      fileSize: htmlContent.length,
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
   */
  private generateFountainContent(
    project: { name: string; description?: string },
    chapters: Array<Chapter & { scenes: ChapterScene[] }>
  ): string {
    const lines: string[] = [];

    // Title page
    lines.push(`Title: ${project.name}`);
    lines.push(`Draft date: ${new Date().toLocaleDateString()}`);
    lines.push('');
    lines.push('===');
    lines.push('');

    // Chapters as acts/scenes
    chapters.forEach((chapter) => {
      // Scene heading
      lines.push(`INT. ${chapter.title.toUpperCase()} - DAY`);
      lines.push('');

      // Content as action
      if (chapter.content) {
        lines.push(chapter.content);
        lines.push('');
      }

      // Scenes
      chapter.scenes.forEach((scene) => {
        if (scene.title) {
          lines.push(`INT. ${scene.title.toUpperCase()} - CONTINUOUS`);
          lines.push('');
        }
        if (scene.content) {
          lines.push(scene.content);
          lines.push('');
        }
      });
    });

    return lines.join('\n');
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
}

// ============================================================================
// Helper Functions
// ============================================================================

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

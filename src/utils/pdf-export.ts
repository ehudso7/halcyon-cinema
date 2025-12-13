import { jsPDF } from 'jspdf';
import { Project } from '@/types';

interface PDFExportOptions {
  includePrompts?: boolean;
  includeMetadata?: boolean;
  layout?: 'grid' | 'single';
}

export async function exportProjectAsPDF(
  project: Project,
  options: PDFExportOptions = {}
): Promise<Blob> {
  const {
    includePrompts = true,
    includeMetadata = false,
    layout = 'single',
  } = options;

  // Create PDF in landscape for better image display
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Title page
  pdf.setFillColor(15, 15, 15);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Logo/brand
  pdf.setFontSize(48);
  pdf.setTextColor(99, 102, 241); // Brand indigo color
  pdf.setFont('helvetica', 'bold');
  pdf.text('HC', pageWidth / 2, pageHeight / 2 - 30, { align: 'center' });

  // Title
  pdf.setFontSize(32);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255); // Reset to white for title
  pdf.text(project.name, pageWidth / 2, pageHeight / 2, { align: 'center' });

  // Subtitle
  if (project.description) {
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(160, 160, 160);
    const descLines = pdf.splitTextToSize(project.description, contentWidth);
    pdf.text(descLines, pageWidth / 2, pageHeight / 2 + 15, { align: 'center' });
  }

  // Scene count
  pdf.setFontSize(12);
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `${project.scenes.length} ${project.scenes.length === 1 ? 'Scene' : 'Scenes'}`,
    pageWidth / 2,
    pageHeight / 2 + 35,
    { align: 'center' }
  );

  // Footer
  pdf.setFontSize(10);
  pdf.text('Created with HALCYON-Cinema', pageWidth / 2, pageHeight - 20, { align: 'center' });
  pdf.text(new Date().toLocaleDateString(), pageWidth / 2, pageHeight - 12, { align: 'center' });

  // Process scenes
  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];
    pdf.addPage();

    // Dark background
    pdf.setFillColor(15, 15, 15);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    // Scene header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(`Scene ${i + 1}`, margin, margin + 5);

    // Progress indicator
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`${i + 1} / ${project.scenes.length}`, pageWidth - margin, margin + 5, { align: 'right' });

    let imageY = margin + 15;
    const imageHeight = pageHeight - margin * 2 - 50;

    // Add image if available
    if (scene.imageUrl) {
      try {
        const imageData = await fetchImageAsDataURL(scene.imageUrl);
        if (imageData) {
          // Calculate image dimensions to fit
          const maxImageWidth = layout === 'single' ? contentWidth : contentWidth * 0.6;
          const maxImageHeight = includePrompts ? imageHeight * 0.7 : imageHeight;

          // Add image centered
          const imageX = layout === 'single' ? margin : margin;
          pdf.addImage(
            imageData,
            'JPEG',
            imageX,
            imageY,
            maxImageWidth,
            maxImageHeight,
            undefined,
            'MEDIUM'
          );
          imageY += maxImageHeight + 10;
        }
      } catch (error) {
        console.error('Failed to add image to PDF:', error);
        // Add placeholder
        pdf.setFillColor(30, 30, 30);
        pdf.rect(margin, imageY, contentWidth * 0.6, imageHeight * 0.5, 'F');
        pdf.setTextColor(80, 80, 80);
        pdf.setFontSize(12);
        pdf.text('Image not available', margin + contentWidth * 0.3, imageY + imageHeight * 0.25, { align: 'center' });
        imageY += imageHeight * 0.5 + 10;
      }
    }

    // Add prompt
    if (includePrompts) {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(160, 160, 160);
      pdf.text('PROMPT', margin, imageY);

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(220, 220, 220);
      const promptLines = pdf.splitTextToSize(scene.prompt, contentWidth);
      pdf.text(promptLines.slice(0, 4), margin, imageY + 6);
    }

    // Add metadata if requested
    if (includeMetadata && scene.metadata) {
      const metaY = pageHeight - margin - 15;
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);

      const metaParts: string[] = [];
      if (scene.metadata.shotType) metaParts.push(`Shot: ${scene.metadata.shotType}`);
      if (scene.metadata.style) metaParts.push(`Style: ${scene.metadata.style}`);
      if (scene.metadata.lighting) metaParts.push(`Lighting: ${scene.metadata.lighting}`);
      if (scene.metadata.mood) metaParts.push(`Mood: ${scene.metadata.mood}`);

      if (metaParts.length > 0) {
        pdf.text(metaParts.join(' | '), margin, metaY);
      }
    }
  }

  // Return as blob
  return pdf.output('blob');
}

async function fetchImageAsDataURL(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    console.error('Failed to fetch image:', url);
    return null;
  }
}

export async function downloadProjectPDF(project: Project, options?: PDFExportOptions): Promise<void> {
  const blob = await exportProjectAsPDF(project, options);

  // Create download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-storyboard.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

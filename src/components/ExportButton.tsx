import { useState } from 'react';
import { Project } from '@/types';
import { downloadProjectPDF } from '@/utils/pdf-export';
import { useToast } from './Toast';
import styles from './ExportButton.module.css';

interface ExportButtonProps {
  project: Project;
  disabled?: boolean;
}

export default function ExportButton({ project, disabled }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { showError, showSuccess } = useToast();

  const handleExportZIP = () => {
    window.open(`/api/export/project/${project.id}`, '_blank');
    showSuccess('ZIP export started');
    setIsOpen(false);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await downloadProjectPDF(project, {
        includePrompts: true,
        includeMetadata: true,
      });
      showSuccess('PDF exported successfully');
    } catch (error) {
      console.error('PDF export failed:', error);
      showError('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  return (
    <div className={styles.container}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-secondary"
        disabled={disabled || project.scenes.length === 0}
        title="Export Project"
      >
        {isExporting ? (
          <span className="spinner" />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
        )}
        Export
      </button>

      {isOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsOpen(false)} />
          <div className={styles.dropdown}>
            <button onClick={handleExportPDF} className={styles.option} disabled={isExporting}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <div className={styles.optionText}>
                <span className={styles.optionTitle}>Export as PDF</span>
                <span className={styles.optionDesc}>Storyboard with images & prompts</span>
              </div>
            </button>
            <button onClick={handleExportZIP} className={styles.option}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
              </svg>
              <div className={styles.optionText}>
                <span className={styles.optionTitle}>Export as ZIP</span>
                <span className={styles.optionDesc}>All images & metadata files</span>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useCallback } from 'react';
import { SparklesIcon, AlertIcon, CheckCircleIcon, RefreshIcon } from './Icons';
import styles from './AIProseSanitizer.module.css';

type SanitizeMode = 'subtle' | 'moderate' | 'aggressive';

interface AnalysisIssue {
  match: string;
  index: number;
  length: number;
  category: string;
  suggestion?: string;
}

interface Analysis {
  originalText: string;
  issues: AnalysisIssue[];
  score: number;
  summary: string;
}

interface SanitizeChange {
  original: string;
  replacement: string;
  reason: string;
}

interface SanitizedResult {
  sanitizedText: string;
  changesCount: number;
  changes: SanitizeChange[];
}

interface AIProseSanitizerProps {
  /** The text content to analyze/sanitize */
  content: string;
  /** Callback when content is sanitized */
  onSanitize: (sanitizedContent: string) => void;
  /** Optional: callback for when analysis is complete */
  onAnalysisComplete?: (analysis: Analysis) => void;
  /** Additional class name */
  className?: string;
}

/**
 * AI Prose Sanitizer component for detecting and replacing AI-generated prose patterns
 */
export default function AIProseSanitizer({
  content,
  onSanitize,
  onAnalysisComplete,
  className = '',
}: AIProseSanitizerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSanitizing, setIsSanitizing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [sanitized, setSanitized] = useState<SanitizedResult | null>(null);
  const [mode, setMode] = useState<SanitizeMode>('moderate');
  const [error, setError] = useState<string | null>(null);
  const [showChanges, setShowChanges] = useState(false);

  const analyzeContent = useCallback(async () => {
    if (!content.trim()) {
      setError('No content to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setSanitized(null);

    try {
      const response = await fetch('/api/import/sanitize-prose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          action: 'analyze',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to analyze content');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      onAnalysisComplete?.(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze content');
    } finally {
      setIsAnalyzing(false);
    }
  }, [content, onAnalysisComplete]);

  const sanitizeContent = useCallback(async () => {
    if (!content.trim()) {
      setError('No content to sanitize');
      return;
    }

    setIsSanitizing(true);
    setError(null);

    try {
      const response = await fetch('/api/import/sanitize-prose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          action: 'both',
          mode,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to sanitize content');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setSanitized(data.sanitized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sanitize content');
    } finally {
      setIsSanitizing(false);
    }
  }, [content, mode]);

  const applyChanges = useCallback(() => {
    if (sanitized?.sanitizedText) {
      onSanitize(sanitized.sanitizedText);
      setSanitized(null);
      setAnalysis(null);
    }
  }, [sanitized, onSanitize]);

  const getScoreColor = (score: number): string => {
    if (score < 20) return '#10b981'; // Green
    if (score < 40) return '#f59e0b'; // Yellow
    if (score < 60) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  const getScoreLabel = (score: number): string => {
    if (score < 20) return 'Natural';
    if (score < 40) return 'Slightly AI';
    if (score < 60) return 'Moderate AI';
    return 'Heavy AI';
  };

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <SparklesIcon size={20} color="#D4AF37" />
        <h3 className={styles.title}>AI Prose Sanitizer</h3>
      </div>

      <p className={styles.description}>
        Analyze your content for AI-generated patterns and replace them with natural prose.
      </p>

      {/* Mode Selection */}
      <div className={styles.modeSection}>
        <label className={styles.modeLabel}>Sanitization Intensity:</label>
        <div className={styles.modeButtons}>
          {(['subtle', 'moderate', 'aggressive'] as SanitizeMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`${styles.modeButton} ${mode === m ? styles.active : ''}`}
              onClick={() => setMode(m)}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <p className={styles.modeHint}>
          {mode === 'subtle' && 'Minimal changes - only fix obvious AI phrases'}
          {mode === 'moderate' && 'Balanced improvements - fix AI patterns and improve flow'}
          {mode === 'aggressive' && 'Extensive rewrite - transform to sound fully natural'}
        </p>
      </div>

      {/* Action Buttons */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.analyzeButton}
          onClick={analyzeContent}
          disabled={isAnalyzing || isSanitizing}
        >
          {isAnalyzing ? (
            <>
              <span className={styles.spinner} />
              Analyzing...
            </>
          ) : (
            <>
              <AlertIcon size={16} />
              Analyze Only
            </>
          )}
        </button>

        <button
          type="button"
          className={styles.sanitizeButton}
          onClick={sanitizeContent}
          disabled={isAnalyzing || isSanitizing}
        >
          {isSanitizing ? (
            <>
              <span className={styles.spinner} />
              Sanitizing...
            </>
          ) : (
            <>
              <SparklesIcon size={16} />
              Analyze & Sanitize
            </>
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className={styles.error}>
          <AlertIcon size={16} />
          {error}
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className={styles.results}>
          <div className={styles.scoreCard}>
            <div className={styles.scoreCircle} style={{ borderColor: getScoreColor(analysis.score) }}>
              <span className={styles.scoreValue} style={{ color: getScoreColor(analysis.score) }}>
                {analysis.score}
              </span>
              <span className={styles.scoreUnit}>/ 100</span>
            </div>
            <div className={styles.scoreInfo}>
              <span className={styles.scoreLabel} style={{ color: getScoreColor(analysis.score) }}>
                {getScoreLabel(analysis.score)}
              </span>
              <p className={styles.scoreSummary}>{analysis.summary}</p>
            </div>
          </div>

          {analysis.issues.length > 0 && (
            <div className={styles.issuesSection}>
              <h4 className={styles.issuesTitle}>
                Found {analysis.issues.length} AI pattern{analysis.issues.length !== 1 ? 's' : ''}
              </h4>
              <div className={styles.issuesList}>
                {analysis.issues.slice(0, 10).map((issue, idx) => (
                  <span key={idx} className={styles.issueTag}>
                    "{issue.match}"
                  </span>
                ))}
                {analysis.issues.length > 10 && (
                  <span className={styles.moreIssues}>
                    +{analysis.issues.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sanitization Results */}
      {sanitized && (
        <div className={styles.sanitizedResults}>
          <div className={styles.sanitizedHeader}>
            <CheckCircleIcon size={20} color="#10b981" />
            <span>Made {sanitized.changesCount} improvement{sanitized.changesCount !== 1 ? 's' : ''}</span>
          </div>

          {sanitized.changes.length > 0 && (
            <>
              <button
                type="button"
                className={styles.toggleChanges}
                onClick={() => setShowChanges(!showChanges)}
              >
                {showChanges ? 'Hide Changes' : 'Show Changes'}
              </button>

              {showChanges && (
                <div className={styles.changesList}>
                  {sanitized.changes.map((change, idx) => (
                    <div key={idx} className={styles.changeItem}>
                      <div className={styles.changeOriginal}>
                        <span className={styles.changeLabel}>Before:</span>
                        <span className={styles.changeText}>{change.original}</span>
                      </div>
                      <div className={styles.changeReplacement}>
                        <span className={styles.changeLabel}>After:</span>
                        <span className={styles.changeText}>{change.replacement}</span>
                      </div>
                      <p className={styles.changeReason}>{change.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className={styles.applyActions}>
            <button
              type="button"
              className={styles.discardButton}
              onClick={() => {
                setSanitized(null);
                setAnalysis(null);
              }}
            >
              Discard
            </button>
            <button
              type="button"
              className={styles.applyButton}
              onClick={applyChanges}
            >
              <CheckCircleIcon size={16} />
              Apply Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline RefreshIcon if not in Icons
function RefreshIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

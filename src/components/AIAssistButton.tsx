import { useState, useCallback, useRef, useEffect } from 'react';
import { SparklesIcon, CloseIcon } from './Icons';
import styles from './AIAssistButton.module.css';

interface Suggestion {
  id: string;
  text: string;
  type?: 'replace' | 'append' | 'enhance';
}

interface AIAssistButtonProps {
  fieldName: string;
  currentValue: string;
  context?: string;
  onApply: (suggestion: string, type: 'replace' | 'append' | 'enhance') => void;
  placeholder?: string;
  disabled?: boolean;
  position?: 'right' | 'bottom';
  size?: 'small' | 'medium';
}

/**
 * AI Assist Button component that provides contextual AI suggestions
 * for any input field or task.
 */
export default function AIAssistButton({
  fieldName,
  currentValue,
  context = '',
  onApply,
  placeholder = 'AI will suggest improvements...',
  disabled = false,
  position = 'right',
  size = 'medium',
}: AIAssistButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setSuggestions([]);

    try {
      const response = await fetch('/api/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldName,
          currentValue,
          context,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error('[ai-assist] Error fetching suggestions:', err);
      setError('Unable to generate suggestions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [fieldName, currentValue, context]);

  const handleToggle = () => {
    if (!isOpen) {
      setIsOpen(true);
      fetchSuggestions();
    } else {
      setIsOpen(false);
    }
  };

  const handleApplySuggestion = (suggestion: Suggestion) => {
    onApply(suggestion.text, suggestion.type || 'replace');
    setIsOpen(false);
  };

  const handleRefresh = () => {
    fetchSuggestions();
  };

  return (
    <div className={`${styles.container} ${styles[position]}`}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.button} ${styles[size]} ${isOpen ? styles.active : ''}`}
        onClick={handleToggle}
        disabled={disabled}
        title="AI Assist"
        aria-label={`AI suggestions for ${fieldName}`}
        aria-expanded={isOpen}
      >
        <SparklesIcon size={size === 'small' ? 14 : 16} />
        {size === 'medium' && <span>AI</span>}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className={`${styles.popover} ${styles[`popover${position.charAt(0).toUpperCase() + position.slice(1)}`]}`}
          role="dialog"
          aria-label="AI Suggestions"
        >
          <div className={styles.popoverHeader}>
            <span className={styles.popoverTitle}>
              <SparklesIcon size={16} />
              AI Suggestions
            </span>
            <div className={styles.popoverActions}>
              <button
                type="button"
                className={styles.refreshBtn}
                onClick={handleRefresh}
                disabled={isLoading}
                title="Refresh suggestions"
              >
                ↻
              </button>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <CloseIcon size={16} />
              </button>
            </div>
          </div>

          <div className={styles.popoverContent}>
            {isLoading && (
              <div className={styles.loading}>
                <div className={styles.spinner} />
                <span>Generating suggestions...</span>
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            {!isLoading && !error && suggestions.length === 0 && (
              <p className={styles.placeholder}>{placeholder}</p>
            )}

            {!isLoading && suggestions.length > 0 && (
              <div className={styles.suggestionList}>
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className={styles.suggestion}
                    onClick={() => handleApplySuggestion(suggestion)}
                  >
                    <span className={styles.suggestionText}>{suggestion.text}</span>
                    <span className={`${styles.suggestionType} ${styles[suggestion.type || 'replace']}`}>
                      {suggestion.type === 'append' ? 'Add' : suggestion.type === 'enhance' ? 'Enhance' : 'Replace'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.popoverFooter}>
            <span className={styles.hint}>Click a suggestion to apply</span>
          </div>
        </div>
      )}
    </div>
  );
}

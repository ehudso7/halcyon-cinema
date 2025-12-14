import { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDownIcon } from './Icons';
import styles from './Collapsible.module.css';

interface CollapsibleProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  children: ReactNode;
  className?: string;
  onToggle?: (isOpen: boolean) => void;
}

/**
 * Collapsible section component with smooth expand/collapse animation.
 * Use for sections that benefit from being minimized to reduce visual clutter.
 */
export default function Collapsible({
  title,
  subtitle,
  icon,
  defaultOpen = true,
  badge,
  children,
  className = '',
  onToggle,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto');

  useEffect(() => {
    if (contentRef.current) {
      if (isOpen) {
        // Measure content height for smooth animation
        const height = contentRef.current.scrollHeight;
        setContentHeight(height);
        // After animation, set to auto to allow dynamic content
        const timer = setTimeout(() => setContentHeight('auto'), 300);
        return () => clearTimeout(timer);
      } else {
        // First set to current height to enable transition
        setContentHeight(contentRef.current.scrollHeight);
        // Then trigger collapse
        requestAnimationFrame(() => setContentHeight(0));
      }
    }
  }, [isOpen]);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <div className={`${styles.collapsible} ${className}`}>
      <button
        className={styles.header}
        onClick={handleToggle}
        aria-expanded={isOpen}
        type="button"
      >
        <div className={styles.headerContent}>
          {icon && <span className={styles.icon}>{icon}</span>}
          <div className={styles.titleGroup}>
            <span className={styles.title}>{title}</span>
            {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
          </div>
          {badge !== undefined && (
            <span className={styles.badge}>{badge}</span>
          )}
        </div>
        <ChevronDownIcon
          size={20}
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
        />
      </button>
      <div
        ref={contentRef}
        className={styles.content}
        style={{
          height: typeof contentHeight === 'number' ? `${contentHeight}px` : contentHeight,
          overflow: isOpen && contentHeight === 'auto' ? 'visible' : 'hidden',
        }}
      >
        <div className={styles.inner}>{children}</div>
      </div>
    </div>
  );
}

import Image from 'next/image';
import styles from '@/styles/BrandLogo.module.css';

interface BrandLogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  className?: string;
}

const sizes = {
  small: 28,
  medium: 40,
  large: 64,
};

export default function BrandLogo({ size = 'medium', showText = true, className = '' }: BrandLogoProps) {
  const dimension = sizes[size];

  return (
    <div className={`${styles.brand} ${styles[size]} ${className}`}>
      <div className={styles.logoWrapper}>
        <Image
          src="/images/logo.svg"
          alt="HALCYON-Cinema"
          width={dimension}
          height={dimension}
          className={styles.logo}
          priority
        />
      </div>
      {showText && (
        <span className={styles.text}>
          <span className={styles.halcyon}>HALCYON</span>
          <span className={styles.cinema}>Cinema</span>
        </span>
      )}
    </div>
  );
}

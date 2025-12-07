import { VisualStyle } from '@/types';
import styles from './VisualStyleSelector.module.css';

interface VisualStyleSelectorProps {
  selectedStyleId: string | null;
  onSelectStyle: (styleId: string | null) => void;
}

export const VISUAL_STYLES: VisualStyle[] = [
  {
    id: 'photorealistic',
    name: 'Photorealistic',
    description: 'Ultra-realistic photography',
    promptModifier: 'photorealistic, ultra-detailed, 8k resolution, professional photography',
  },
  {
    id: 'cinematic',
    name: '35mm Film',
    description: 'Classic cinema look',
    promptModifier: '35mm film, cinematic lighting, movie still, anamorphic lens, film grain',
  },
  {
    id: 'anime',
    name: 'Anime',
    description: 'Japanese animation style',
    promptModifier: 'anime style, vibrant colors, dramatic shading, clean lines, cel shading',
  },
  {
    id: 'ghibli',
    name: 'Studio Ghibli',
    description: 'Miyazaki-inspired art',
    promptModifier: 'Studio Ghibli style, hand-painted, lush scenery, whimsical, Hayao Miyazaki',
  },
  {
    id: 'dark-fantasy',
    name: 'Dark Fantasy',
    description: 'Gothic, mysterious',
    promptModifier: 'dark fantasy, gothic atmosphere, dramatic shadows, moody, mystical',
  },
  {
    id: 'concept-art',
    name: 'Concept Art',
    description: 'Game/film concept style',
    promptModifier: 'concept art, digital painting, detailed environment, professional illustration',
  },
  {
    id: 'noir',
    name: 'Film Noir',
    description: '1940s detective aesthetic',
    promptModifier: 'film noir, black and white, high contrast, venetian blind shadows, moody',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Neon-lit future',
    promptModifier: 'cyberpunk, neon lights, rain-slicked streets, futuristic, blade runner style',
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    description: 'Soft, painterly',
    promptModifier: 'watercolor painting, soft edges, flowing colors, artistic, delicate',
  },
  {
    id: 'wes-anderson',
    name: 'Wes Anderson',
    description: 'Symmetrical, pastel',
    promptModifier: 'Wes Anderson style, symmetrical composition, pastel color palette, quirky',
  },
  {
    id: 'oil-painting',
    name: 'Oil Painting',
    description: 'Classical fine art',
    promptModifier: 'oil painting, classical art, rich textures, masterpiece quality, museum piece',
  },
  {
    id: 'retro-scifi',
    name: 'Retro Sci-Fi',
    description: '50s-60s space age',
    promptModifier: 'retro sci-fi, 1950s futurism, ray guns, flying saucers, atomic age',
  },
];

export default function VisualStyleSelector({ selectedStyleId, onSelectStyle }: VisualStyleSelectorProps) {
  return (
    <div className={styles.selector}>
      <label className={styles.label}>Visual Style</label>
      <div className={styles.grid}>
        <button
          onClick={() => onSelectStyle(null)}
          className={`${styles.styleButton} ${!selectedStyleId ? styles.selected : ''}`}
        >
          <span className={styles.styleName}>None</span>
          <span className={styles.styleDesc}>Use prompt as-is</span>
        </button>
        {VISUAL_STYLES.map(style => (
          <button
            key={style.id}
            onClick={() => onSelectStyle(style.id)}
            className={`${styles.styleButton} ${selectedStyleId === style.id ? styles.selected : ''}`}
          >
            <span className={styles.styleName}>{style.name}</span>
            <span className={styles.styleDesc}>{style.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function getStyleModifier(styleId: string | null): string {
  if (!styleId) return '';
  const style = VISUAL_STYLES.find(s => s.id === styleId);
  return style?.promptModifier || '';
}

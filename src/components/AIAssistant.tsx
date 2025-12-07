import { useState } from 'react';
import { AISuggestion } from '@/types';
import styles from './AIAssistant.module.css';

interface AIAssistantProps {
  currentPrompt: string;
  onApplySuggestion: (addition: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const SUGGESTION_CATEGORIES = [
  { id: 'lighting', name: 'Lighting', icon: '💡' },
  { id: 'mood', name: 'Mood', icon: '🎭' },
  { id: 'composition', name: 'Composition', icon: '📐' },
  { id: 'story', name: 'Story', icon: '📖' },
  { id: 'style', name: 'Style', icon: '🎨' },
];

const SUGGESTIONS: Record<string, AISuggestion[]> = {
  lighting: [
    { id: 'l1', type: 'lighting', title: 'Golden Hour Magic', description: 'Warm, soft light of sunset or sunrise', promptAddition: 'bathed in warm golden hour light, long shadows, soft diffused sunlight' },
    { id: 'l2', type: 'lighting', title: 'Dramatic Chiaroscuro', description: 'High contrast light and shadow', promptAddition: 'dramatic chiaroscuro lighting, deep shadows, single strong light source' },
    { id: 'l3', type: 'lighting', title: 'Neon Glow', description: 'Cyberpunk-style neon illumination', promptAddition: 'neon lights casting colorful glows, reflective surfaces, pink and blue tones' },
    { id: 'l4', type: 'lighting', title: 'Moonlit Night', description: 'Soft, ethereal moonlight', promptAddition: 'soft moonlight illumination, blue tint, mystical atmosphere' },
    { id: 'l5', type: 'lighting', title: 'Rim Lighting', description: 'Backlit subject silhouette', promptAddition: 'strong rim lighting, silhouetted edges, glowing outline' },
  ],
  mood: [
    { id: 'm1', type: 'mood', title: 'Epic & Heroic', description: 'Grand, inspiring atmosphere', promptAddition: 'epic atmosphere, heroic stance, triumphant mood, cinematic grandeur' },
    { id: 'm2', type: 'mood', title: 'Mysterious & Eerie', description: 'Suspenseful, unknown', promptAddition: 'mysterious atmosphere, foggy, eerie shadows, sense of unknown' },
    { id: 'm3', type: 'mood', title: 'Melancholic', description: 'Sad, reflective mood', promptAddition: 'melancholic mood, rainy weather, subdued colors, contemplative' },
    { id: 'm4', type: 'mood', title: 'Romantic', description: 'Warm, intimate feeling', promptAddition: 'romantic atmosphere, soft focus, warm tones, intimate setting' },
    { id: 'm5', type: 'mood', title: 'Tense & Suspenseful', description: 'Edge-of-seat feeling', promptAddition: 'tense atmosphere, dramatic shadows, suspenseful composition' },
  ],
  composition: [
    { id: 'c1', type: 'composition', title: 'Rule of Thirds', description: 'Subject off-center', promptAddition: 'rule of thirds composition, balanced asymmetry' },
    { id: 'c2', type: 'composition', title: 'Leading Lines', description: 'Lines drawing eye to subject', promptAddition: 'leading lines pointing to subject, depth perspective' },
    { id: 'c3', type: 'composition', title: 'Symmetrical Balance', description: 'Mirror-like composition', promptAddition: 'symmetrical composition, balanced framing, centered subject' },
    { id: 'c4', type: 'composition', title: 'Dutch Angle', description: 'Tilted camera for tension', promptAddition: 'dutch angle, tilted perspective, dynamic tension' },
    { id: 'c5', type: 'composition', title: 'Extreme Close-Up', description: 'Intimate detail focus', promptAddition: 'extreme close-up, macro detail, shallow depth of field' },
  ],
  story: [
    { id: 's1', type: 'story', title: 'The Journey Begins', description: 'Hero leaving home', promptAddition: 'protagonist at threshold, looking toward horizon, adventure awaits' },
    { id: 's2', type: 'story', title: 'Confrontation', description: 'Facing the antagonist', promptAddition: 'dramatic confrontation, opposing forces, tension between characters' },
    { id: 's3', type: 'story', title: 'Moment of Truth', description: 'Critical decision point', promptAddition: 'pivotal moment, character at crossroads, consequential choice' },
    { id: 's4', type: 'story', title: 'Victory', description: 'Triumphant resolution', promptAddition: 'triumphant victory, celebration, goal achieved' },
    { id: 's5', type: 'story', title: 'Aftermath', description: 'Reflection after events', promptAddition: 'quiet aftermath, contemplation, changed world' },
  ],
  style: [
    { id: 'st1', type: 'style', title: 'Film Noir', description: '1940s detective aesthetic', promptAddition: 'film noir style, black and white, high contrast, venetian blind shadows' },
    { id: 'st2', type: 'style', title: 'Studio Ghibli', description: 'Miyazaki animation style', promptAddition: 'Studio Ghibli style, hand-drawn animation, lush nature, whimsical' },
    { id: 'st3', type: 'style', title: 'Cyberpunk', description: 'Futuristic dystopia', promptAddition: 'cyberpunk aesthetic, neon-lit streets, rain, high-tech low-life' },
    { id: 'st4', type: 'style', title: 'Renaissance Art', description: 'Classical painting style', promptAddition: 'renaissance painting style, chiaroscuro, dramatic poses, oil on canvas' },
    { id: 'st5', type: 'style', title: 'Wes Anderson', description: 'Symmetrical, pastel palette', promptAddition: 'Wes Anderson style, symmetrical framing, pastel colors, quirky' },
  ],
};

export default function AIAssistant({ currentPrompt, onApplySuggestion, isOpen, onToggle }: AIAssistantProps) {
  const [activeCategory, setActiveCategory] = useState('lighting');
  const [isGenerating, setIsGenerating] = useState(false);
  const [customSuggestions, setCustomSuggestions] = useState<AISuggestion[]>([]);

  const handleGenerateCustom = async () => {
    if (!currentPrompt.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt }),
      });

      if (response.ok) {
        const data = await response.json();
        setCustomSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to get AI suggestions:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) {
    return (
      <button onClick={onToggle} className={styles.toggleButton} title="Open AI Assistant">
        <span className={styles.toggleIcon}>🤖</span>
        <span className={styles.toggleLabel}>AI Assistant</span>
      </button>
    );
  }

  const suggestions = customSuggestions.length > 0 && activeCategory === 'custom'
    ? customSuggestions
    : SUGGESTIONS[activeCategory] || [];

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <span>🤖</span> AI Assistant
        </h3>
        <button onClick={onToggle} className={styles.closeButton}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className={styles.categories}>
        {SUGGESTION_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`${styles.categoryBtn} ${activeCategory === cat.id ? styles.active : ''}`}
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      <div className={styles.customSection}>
        <button
          onClick={handleGenerateCustom}
          className={styles.customButton}
          disabled={isGenerating || !currentPrompt.trim()}
        >
          {isGenerating ? (
            <>
              <span className="spinner" />
              Analyzing...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Get Custom Suggestions
            </>
          )}
        </button>
      </div>

      <div className={styles.suggestions}>
        {suggestions.map(suggestion => (
          <div key={suggestion.id} className={styles.suggestion}>
            <div className={styles.suggestionHeader}>
              <h4 className={styles.suggestionTitle}>{suggestion.title}</h4>
              <button
                onClick={() => suggestion.promptAddition && onApplySuggestion(suggestion.promptAddition)}
                className={styles.applyButton}
              >
                Apply
              </button>
            </div>
            <p className={styles.suggestionDescription}>{suggestion.description}</p>
            {suggestion.promptAddition && (
              <p className={styles.promptPreview}>+ {suggestion.promptAddition}</p>
            )}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <p className={styles.tip}>
          💡 Tip: Apply multiple suggestions to create unique combinations!
        </p>
      </div>
    </div>
  );
}

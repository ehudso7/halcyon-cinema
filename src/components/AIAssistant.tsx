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
    { id: 'l1', type: 'lighting', title: 'Golden Hour Windows', description: 'Dramatic interior lighting', promptAddition: 'golden hour sunlight flooding through broken windows, warm rays cutting through dust particles' },
    { id: 'l2', type: 'lighting', title: 'Pale Moonlight', description: 'Ethereal night scene', promptAddition: 'pale moonlight casting long shadows on stone tiles, silver-blue illumination' },
    { id: 'l3', type: 'lighting', title: 'Clinical Fluorescent', description: 'Harsh overhead lighting', promptAddition: 'harsh overhead fluorescent lighting, clinical and cold, sterile atmosphere' },
    { id: 'l4', type: 'lighting', title: 'Neon Reflections', description: 'Cyberpunk street glow', promptAddition: 'neon pink and cyan reflections on wet alleyway pavement, rain-slicked surfaces' },
    { id: 'l5', type: 'lighting', title: 'Candlelit Ambiance', description: 'Warm flickering light', promptAddition: 'warm candlelight flickering over ancient tomes, dancing shadows on stone walls' },
    { id: 'l6', type: 'lighting', title: 'Dramatic Chiaroscuro', description: 'Renaissance contrast', promptAddition: 'dramatic chiaroscuro lighting, deep shadows, single strong directional light' },
    { id: 'l7', type: 'lighting', title: 'Rim Lighting', description: 'Glowing silhouette edges', promptAddition: 'strong rim lighting, backlit silhouette, glowing outline defining the subject' },
  ],
  mood: [
    { id: 'm1', type: 'mood', title: 'Serene & Ethereal', description: 'Time stands still', promptAddition: 'serene and ethereal atmosphere, as if time has paused, transcendent calm' },
    { id: 'm2', type: 'mood', title: 'Tense & Paranoid', description: 'Every shadow a threat', promptAddition: 'tense and paranoid mood, every shadow a threat, heart-pounding suspense' },
    { id: 'm3', type: 'mood', title: 'Melancholic Haunting', description: 'Lost in memories', promptAddition: 'melancholic atmosphere, haunted by lost memories, bittersweet nostalgia' },
    { id: 'm4', type: 'mood', title: 'Hopeful Defiance', description: 'Against all odds', promptAddition: 'hopeful despite overwhelming odds, defiant spirit, dawn after darkness' },
    { id: 'm5', type: 'mood', title: 'Sinister Beauty', description: 'Darkness beneath', promptAddition: 'sinister undertone beneath surface beauty, unsettling elegance, dark allure' },
    { id: 'm6', type: 'mood', title: 'Epic Triumph', description: 'Grand and heroic', promptAddition: 'epic triumphant atmosphere, heroic grandeur, cinematic magnificence' },
  ],
  composition: [
    { id: 'c1', type: 'composition', title: 'Dutch Angle Close-Up', description: 'Mental instability', promptAddition: 'dutch angle close-up emphasizing mental instability, tilted frame, psychological tension' },
    { id: 'c2', type: 'composition', title: 'Over-the-Shoulder', description: 'Stalking perspective', promptAddition: 'over-the-shoulder view of the assassin watching a target, voyeuristic tension' },
    { id: 'c3', type: 'composition', title: 'Extreme Wide Shot', description: 'Scale and isolation', promptAddition: 'extreme wide shot showing a lone figure against a massive backdrop, epic scale' },
    { id: 'c4', type: 'composition', title: 'Low Angle Power', description: 'Towering dominance', promptAddition: 'low camera angle looking up at towering architecture, imposing grandeur' },
    { id: 'c5', type: 'composition', title: 'Aerial Battlefield', description: 'Strategic overview', promptAddition: 'high aerial shot revealing battlefield formations, god\'s eye view of conflict' },
    { id: 'c6', type: 'composition', title: 'Symmetrical Frame', description: 'Perfect balance', promptAddition: 'perfectly symmetrical composition, balanced framing, geometric harmony' },
  ],
  story: [
    { id: 's1', type: 'story', title: 'Fallen City', description: 'Once great, now dark', promptAddition: 'a city that once floated above clouds, now sinking into darkness, fallen glory' },
    { id: 's2', type: 'story', title: 'Silent War', description: 'Brewing conflict', promptAddition: 'a war brewing in the silence between empires, tension before the storm' },
    { id: 's3', type: 'story', title: 'Last Memory', description: 'Forgotten language', promptAddition: 'carrying the last memory of a forgotten language, keeper of lost knowledge' },
    { id: 's4', type: 'story', title: 'Hidden Secret', description: 'Ancient mysteries', promptAddition: 'this room holds a secret no one alive remembers, layers of forgotten history' },
    { id: 's5', type: 'story', title: 'Sunless Birth', description: 'Born in shadow', promptAddition: 'born where the sun doesn\'t reach, child of eternal darkness, destined for light' },
    { id: 's6', type: 'story', title: 'Final Stand', description: 'Last hope', promptAddition: 'the last defender standing against impossible odds, final hope of salvation' },
  ],
  style: [
    { id: 'st1', type: 'style', title: 'Evangelion Cel-Shade', description: 'Harsh anime contrast', promptAddition: 'cel-shaded like Evangelion with harsh contrast and line-art shadows, dramatic anime style' },
    { id: 'st2', type: 'style', title: 'Baroque Masterpiece', description: 'Classical oil painting', promptAddition: 'painted like a Baroque oil masterpiece, dramatic lighting, museum quality' },
    { id: 'st3', type: 'style', title: '35mm Film', description: 'Classic cinema', promptAddition: 'ultra-realistic 35mm film with lens bloom and subtle grain, cinematic authenticity' },
    { id: 'st4', type: 'style', title: 'Ghibli Whimsy', description: 'Miyazaki inspired', promptAddition: 'Ghibli-inspired pastel tones and whimsical proportions, hand-painted warmth' },
    { id: 'st5', type: 'style', title: 'UE5 Cyberpunk', description: 'Next-gen rendering', promptAddition: 'cyberpunk rendered in Unreal Engine 5, photorealistic with neon atmosphere' },
    { id: 'st6', type: 'style', title: 'Wes Anderson', description: 'Symmetrical pastels', promptAddition: 'Wes Anderson style, symmetrical framing, pastel color palette, quirky aesthetic' },
    { id: 'st7', type: 'style', title: 'Film Noir', description: '1940s detective', promptAddition: 'classic film noir, black and white, high contrast, venetian blind shadows' },
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
        setActiveCategory('custom');
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

  const suggestions = activeCategory === 'custom' && customSuggestions.length > 0
    ? customSuggestions
    : SUGGESTIONS[activeCategory] || [];

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <span>🤖</span> AI Creative Assistant
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
              Analyzing your scene...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Get AI-Powered Suggestions
            </>
          )}
        </button>
        {currentPrompt.trim() === '' && (
          <p className={styles.hint}>Enter a scene description to get personalized suggestions</p>
        )}
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
                + Apply
              </button>
            </div>
            <p className={styles.suggestionDescription}>{suggestion.description}</p>
            {suggestion.promptAddition && (
              <p className={styles.promptPreview}>{suggestion.promptAddition}</p>
            )}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <p className={styles.tip}>
          💡 Combine multiple suggestions to create unique cinematic moments!
        </p>
      </div>
    </div>
  );
}

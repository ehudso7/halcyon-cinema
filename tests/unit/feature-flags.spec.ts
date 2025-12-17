/**
 * Unit tests for feature-flags.ts
 *
 * Tests cover:
 * - Valid path traversal through nested objects
 * - Early return when encountering primitive values mid-traversal
 * - Handling of null/undefined in paths
 * - Feature access checks for different tiers
 * - Feature limit retrieval
 */

import { describe, it, expect } from 'vitest';
import {
  hasFeatureAccess,
  getFeatureLimit,
  canTransitionMode,
  canUseCinema,
  canUseWritersRoom,
  canUseLiteraryWorks,
  TIER_FEATURES,
  getAvailableFeatures,
  isRuntimeFeatureEnabled,
} from '@/config/feature-flags';

describe('hasFeatureAccess', () => {
  describe('valid nested object traversal', () => {
    it('should return true for enabled boolean features', () => {
      expect(hasFeatureAccess('starter', 'literaryWorks.enabled')).toBe(true);
      expect(hasFeatureAccess('pro', 'writersRoom.enabled')).toBe(true);
      expect(hasFeatureAccess('enterprise', 'cinema.enabled')).toBe(true);
    });

    it('should return false for disabled boolean features', () => {
      expect(hasFeatureAccess('starter', 'writersRoom.enabled')).toBe(false);
      expect(hasFeatureAccess('starter', 'literaryWorks.canonLocking')).toBe(false);
    });

    it('should return true for non-zero numeric features', () => {
      expect(hasFeatureAccess('starter', 'maxProjects')).toBe(true);
      expect(hasFeatureAccess('pro', 'monthlyCredits')).toBe(true);
    });

    it('should handle deeply nested paths', () => {
      expect(hasFeatureAccess('pro', 'literaryWorks.canonVersioning')).toBe(true);
      expect(hasFeatureAccess('enterprise', 'advanced.teamCollaboration')).toBe(true);
    });
  });

  describe('early return for primitive values mid-traversal', () => {
    it('should return false when traversing through a boolean to nested property', () => {
      // Trying to access a property on a boolean value (e.g., enabled.nestedProp)
      expect(hasFeatureAccess('starter', 'literaryWorks.enabled.nestedProp')).toBe(false);
      expect(hasFeatureAccess('pro', 'cinema.enabled.invalid')).toBe(false);
    });

    it('should return false when traversing through a number to nested property', () => {
      // Trying to access a property on a number value
      expect(hasFeatureAccess('starter', 'maxProjects.nestedProp')).toBe(false);
      expect(hasFeatureAccess('pro', 'monthlyCredits.invalid')).toBe(false);
    });
  });

  describe('handling non-existent paths', () => {
    it('should return false for non-existent top-level properties', () => {
      expect(hasFeatureAccess('starter', 'nonExistent')).toBe(false);
      expect(hasFeatureAccess('pro', 'invalidFeature')).toBe(false);
    });

    it('should return false for non-existent nested properties', () => {
      expect(hasFeatureAccess('starter', 'literaryWorks.nonExistent')).toBe(false);
      expect(hasFeatureAccess('pro', 'cinema.invalidProperty')).toBe(false);
    });

    it('should return false for deeply non-existent paths', () => {
      expect(hasFeatureAccess('starter', 'a.b.c.d.e')).toBe(false);
    });
  });

  describe('tier-specific access', () => {
    it('should correctly differentiate access between tiers', () => {
      // Writer's Room only available for pro and enterprise
      expect(hasFeatureAccess('starter', 'writersRoom.narrativeGeneration')).toBe(false);
      expect(hasFeatureAccess('pro', 'writersRoom.narrativeGeneration')).toBe(true);
      expect(hasFeatureAccess('enterprise', 'writersRoom.narrativeGeneration')).toBe(true);
    });

    it('should grant literary works access to all tiers', () => {
      expect(hasFeatureAccess('starter', 'literaryWorks.enabled')).toBe(true);
      expect(hasFeatureAccess('pro', 'literaryWorks.enabled')).toBe(true);
      expect(hasFeatureAccess('enterprise', 'literaryWorks.enabled')).toBe(true);
    });
  });
});

describe('getFeatureLimit', () => {
  describe('valid nested object traversal', () => {
    it('should return correct numeric limits', () => {
      expect(getFeatureLimit('starter', 'maxProjects')).toBe(3);
      expect(getFeatureLimit('pro', 'maxProjects')).toBe(20);
      expect(getFeatureLimit('enterprise', 'maxProjects')).toBe(-1); // Unlimited
    });

    it('should return correct nested numeric limits', () => {
      expect(getFeatureLimit('starter', 'literaryWorks.maxChaptersPerProject')).toBe(10);
      expect(getFeatureLimit('pro', 'literaryWorks.maxChaptersPerProject')).toBe(50);
      expect(getFeatureLimit('enterprise', 'literaryWorks.maxChaptersPerProject')).toBe(-1);
    });
  });

  describe('early return for primitive values mid-traversal', () => {
    it('should return 0 when traversing through a boolean', () => {
      expect(getFeatureLimit('starter', 'literaryWorks.enabled.nestedProp')).toBe(0);
      expect(getFeatureLimit('pro', 'cinema.enabled.invalid')).toBe(0);
    });

    it('should return 0 when traversing through a number', () => {
      expect(getFeatureLimit('starter', 'maxProjects.nestedProp')).toBe(0);
      expect(getFeatureLimit('pro', 'monthlyCredits.invalid')).toBe(0);
    });
  });

  describe('handling non-existent paths', () => {
    it('should return 0 for non-existent properties', () => {
      expect(getFeatureLimit('starter', 'nonExistent')).toBe(0);
      expect(getFeatureLimit('pro', 'literaryWorks.nonExistent')).toBe(0);
    });
  });

  describe('handling boolean values', () => {
    it('should return 0 for boolean feature values', () => {
      // Boolean values are not numeric limits
      expect(getFeatureLimit('starter', 'literaryWorks.enabled')).toBe(0);
      expect(getFeatureLimit('pro', 'writersRoom.narrativeGeneration')).toBe(0);
    });
  });
});

describe('canTransitionMode', () => {
  it('should allow same-mode transitions', () => {
    expect(canTransitionMode('literary', 'literary')).toBe(true);
    expect(canTransitionMode('writers-room', 'writers-room')).toBe(true);
    expect(canTransitionMode('cinema', 'cinema')).toBe(true);
  });

  it('should allow valid mode transitions', () => {
    // From literary
    expect(canTransitionMode('literary', 'writers-room')).toBe(true);
    expect(canTransitionMode('literary', 'cinema')).toBe(true);

    // From writers-room
    expect(canTransitionMode('writers-room', 'literary')).toBe(true);
    expect(canTransitionMode('writers-room', 'cinema')).toBe(true);

    // From cinema
    expect(canTransitionMode('cinema', 'literary')).toBe(true);
    expect(canTransitionMode('cinema', 'writers-room')).toBe(true);
  });
});

describe('tier feature checks', () => {
  describe('canUseCinema', () => {
    it('should return true for all tiers with cinema enabled', () => {
      expect(canUseCinema('starter')).toBe(true);
      expect(canUseCinema('pro')).toBe(true);
      expect(canUseCinema('enterprise')).toBe(true);
    });
  });

  describe('canUseWritersRoom', () => {
    it('should return false for starter tier', () => {
      expect(canUseWritersRoom('starter')).toBe(false);
    });

    it('should return true for pro and enterprise tiers', () => {
      expect(canUseWritersRoom('pro')).toBe(true);
      expect(canUseWritersRoom('enterprise')).toBe(true);
    });
  });

  describe('canUseLiteraryWorks', () => {
    it('should return true for all tiers', () => {
      expect(canUseLiteraryWorks('starter')).toBe(true);
      expect(canUseLiteraryWorks('pro')).toBe(true);
      expect(canUseLiteraryWorks('enterprise')).toBe(true);
    });
  });
});

describe('TIER_FEATURES structure', () => {
  it('should have all required tiers defined', () => {
    expect(TIER_FEATURES).toHaveProperty('starter');
    expect(TIER_FEATURES).toHaveProperty('pro');
    expect(TIER_FEATURES).toHaveProperty('enterprise');
  });

  it('should have consistent structure across tiers', () => {
    const tiers = ['starter', 'pro', 'enterprise'] as const;

    for (const tier of tiers) {
      expect(TIER_FEATURES[tier]).toHaveProperty('maxProjects');
      expect(TIER_FEATURES[tier]).toHaveProperty('literaryWorks');
      expect(TIER_FEATURES[tier]).toHaveProperty('writersRoom');
      expect(TIER_FEATURES[tier]).toHaveProperty('cinema');
      expect(TIER_FEATURES[tier]).toHaveProperty('exports');
      expect(TIER_FEATURES[tier]).toHaveProperty('advanced');
    }
  });

  it('should have progressively more features in higher tiers', () => {
    expect(TIER_FEATURES.starter.maxProjects).toBeLessThan(TIER_FEATURES.pro.maxProjects);
    expect(TIER_FEATURES.pro.monthlyCredits).toBeLessThan(TIER_FEATURES.enterprise.monthlyCredits);
  });
});

describe('getAvailableFeatures', () => {
  it('should return array of features for each tier', () => {
    const starterFeatures = getAvailableFeatures('starter');
    const proFeatures = getAvailableFeatures('pro');
    const enterpriseFeatures = getAvailableFeatures('enterprise');

    expect(Array.isArray(starterFeatures)).toBe(true);
    expect(Array.isArray(proFeatures)).toBe(true);
    expect(Array.isArray(enterpriseFeatures)).toBe(true);
  });

  it('should include Literary Works Mode for all tiers', () => {
    expect(getAvailableFeatures('starter')).toContain('Literary Works Mode');
    expect(getAvailableFeatures('pro')).toContain('Literary Works Mode');
    expect(getAvailableFeatures('enterprise')).toContain('Literary Works Mode');
  });

  it('should include Writer\'s Room Mode only for pro and enterprise', () => {
    expect(getAvailableFeatures('starter')).not.toContain('Writer\'s Room Mode');
    expect(getAvailableFeatures('pro')).toContain('Writer\'s Room Mode');
    expect(getAvailableFeatures('enterprise')).toContain('Writer\'s Room Mode');
  });

  it('should have more features for higher tiers', () => {
    const starterFeatures = getAvailableFeatures('starter');
    const proFeatures = getAvailableFeatures('pro');
    const enterpriseFeatures = getAvailableFeatures('enterprise');

    expect(proFeatures.length).toBeGreaterThan(starterFeatures.length);
    expect(enterpriseFeatures.length).toBeGreaterThanOrEqual(proFeatures.length);
  });
});

describe('isRuntimeFeatureEnabled', () => {
  it('should return boolean values for runtime flags', () => {
    expect(typeof isRuntimeFeatureEnabled('ENABLE_WRITERS_ROOM')).toBe('boolean');
    expect(typeof isRuntimeFeatureEnabled('ENABLE_CINEMA')).toBe('boolean');
    expect(typeof isRuntimeFeatureEnabled('ENABLE_LITERARY_WORKS')).toBe('boolean');
  });
});

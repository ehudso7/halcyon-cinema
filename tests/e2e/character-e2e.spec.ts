/**
 * E2E Journey Tests: Character Management Flows
 *
 * Tests character creation, viewing, updating, and deletion within projects.
 *
 * Prerequisites:
 * - Dev server running on localhost:3000
 * - .env.local with NEXTAUTH_SECRET set
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  createAuthenticatedSession,
  authGet,
  authPost,
  authPut,
  authDelete,
  AuthSession,
} from './helpers/auth-helper';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('E2E Journey: Character Management', () => {
  let session: AuthSession;
  let projectId: string;
  let createdCharacterId: string;

  beforeAll(async () => {
    // Create authenticated session
    session = await createAuthenticatedSession('character-test');

    // Create a project to add characters to
    const projectResponse = await authPost('/api/projects', session.cookies, {
      name: 'Character Test Project',
      description: 'Project for character E2E tests',
    });
    const project = await projectResponse.json();
    projectId = project.id;
  }, 30000);

  describe('Create Character Flow', () => {
    it('should create a character with name and description', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/characters`,
        session.cookies,
        {
          name: 'Elena Vance',
          description: 'A cyberpunk detective with augmented eyes',
        }
      );

      expect(response.status).toBe(201);

      const character = await response.json();
      expect(character.id).toBeDefined();
      expect(character.name).toBe('Elena Vance');
      expect(character.description).toBe('A cyberpunk detective with augmented eyes');

      createdCharacterId = character.id;
    });

    it('should create a character with traits', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/characters`,
        session.cookies,
        {
          name: 'Marcus Steel',
          description: 'A grizzled war veteran turned mercenary',
          traits: ['brave', 'loyal', 'haunted'],
        }
      );

      expect(response.status).toBe(201);

      const character = await response.json();
      expect(character.name).toBe('Marcus Steel');
      expect(character.traits).toEqual(['brave', 'loyal', 'haunted']);
    });

    it('should create a character with imageUrl', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/characters`,
        session.cookies,
        {
          name: 'Aria Nova',
          description: 'An AI singer with a virtual presence',
          imageUrl: 'https://example.com/aria.png',
        }
      );

      expect(response.status).toBe(201);

      const character = await response.json();
      expect(character.imageUrl).toBe('https://example.com/aria.png');
    });

    it('should reject character without name', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/characters`,
        session.cookies,
        {
          description: 'A character without a name',
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.toLowerCase()).toContain('name');
    });

    it('should reject character without description', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/characters`,
        session.cookies,
        {
          name: 'Nameless Wonder',
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.toLowerCase()).toContain('description');
    });

    it('should reject character for non-existent project', async () => {
      const response = await authPost(
        '/api/projects/non-existent-id/characters',
        session.cookies,
        {
          name: 'Ghost Character',
          description: 'In a non-existent project',
        }
      );

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('Read Character Flow', () => {
    it('should list all characters in a project', async () => {
      const response = await authGet(
        `/api/projects/${projectId}/characters`,
        session.cookies
      );

      expect(response.status).toBe(200);

      const characters = await response.json();
      expect(Array.isArray(characters)).toBe(true);
      expect(characters.length).toBeGreaterThanOrEqual(3); // We created 3 characters
    });

    it('should get a specific character by ID', async () => {
      const response = await authGet(
        `/api/projects/${projectId}/characters/${createdCharacterId}`,
        session.cookies
      );

      expect(response.status).toBe(200);

      const character = await response.json();
      expect(character.id).toBe(createdCharacterId);
      expect(character.name).toBe('Elena Vance');
    });

    it('should get project with all its characters', async () => {
      const response = await authGet(
        `/api/projects/${projectId}`,
        session.cookies
      );

      expect(response.status).toBe(200);

      const project = await response.json();
      expect(Array.isArray(project.characters)).toBe(true);
      expect(project.characters.length).toBeGreaterThanOrEqual(3);
    });

    it('should return 404 for non-existent character', async () => {
      const response = await authGet(
        `/api/projects/${projectId}/characters/non-existent-id`,
        session.cookies
      );

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('Update Character Flow', () => {
    it('should update character name', async () => {
      const response = await authPut(
        `/api/projects/${projectId}/characters/${createdCharacterId}`,
        session.cookies,
        { name: 'Elena M. Vance' }
      );

      expect(response.status).toBe(200);

      const character = await response.json();
      expect(character.name).toBe('Elena M. Vance');
    });

    it('should update character description', async () => {
      const response = await authPut(
        `/api/projects/${projectId}/characters/${createdCharacterId}`,
        session.cookies,
        { description: 'Updated: A legendary detective with neural implants' }
      );

      expect(response.status).toBe(200);

      const character = await response.json();
      expect(character.description).toBe('Updated: A legendary detective with neural implants');
    });

    it('should update character traits', async () => {
      const response = await authPut(
        `/api/projects/${projectId}/characters/${createdCharacterId}`,
        session.cookies,
        { traits: ['intelligent', 'resourceful', 'mysterious'] }
      );

      expect(response.status).toBe(200);

      const character = await response.json();
      expect(character.traits).toEqual(['intelligent', 'resourceful', 'mysterious']);
    });
  });

  describe('Delete Character Flow', () => {
    let characterToDelete: string;

    beforeAll(async () => {
      // Create a character specifically to delete
      const response = await authPost(
        `/api/projects/${projectId}/characters`,
        session.cookies,
        {
          name: 'Character To Delete',
          description: 'Will be deleted in tests',
        }
      );
      const character = await response.json();
      characterToDelete = character.id;
    });

    it('should delete a character', async () => {
      const response = await authDelete(
        `/api/projects/${projectId}/characters/${characterToDelete}`,
        session.cookies
      );

      expect(response.status).toBe(200);

      // Verify character is gone
      const getResponse = await authGet(
        `/api/projects/${projectId}/characters/${characterToDelete}`,
        session.cookies
      );
      expect([401, 404]).toContain(getResponse.status);
    });

    it('should return 404 when deleting non-existent character', async () => {
      const response = await authDelete(
        `/api/projects/${projectId}/characters/non-existent-id`,
        session.cookies
      );

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('Character Isolation (Security)', () => {
    let otherSession: AuthSession;

    beforeAll(async () => {
      // Create another user
      otherSession = await createAuthenticatedSession('char-other-user');
    }, 30000);

    it('should not allow another user to create character in others project', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/characters`,
        otherSession.cookies,
        {
          name: 'Unauthorized Character',
          description: 'Should not be created',
        }
      );

      expect([401, 403]).toContain(response.status);
    });

    it('should not allow another user to list characters', async () => {
      const response = await authGet(
        `/api/projects/${projectId}/characters`,
        otherSession.cookies
      );

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should not allow another user to view character', async () => {
      const response = await authGet(
        `/api/projects/${projectId}/characters/${createdCharacterId}`,
        otherSession.cookies
      );

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should not allow another user to update character', async () => {
      const response = await authPut(
        `/api/projects/${projectId}/characters/${createdCharacterId}`,
        otherSession.cookies,
        { name: 'Hacked Name' }
      );

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should not allow another user to delete character', async () => {
      const response = await authDelete(
        `/api/projects/${projectId}/characters/${createdCharacterId}`,
        otherSession.cookies
      );

      expect([401, 403, 404]).toContain(response.status);
    });
  });

  describe('Unauthenticated Access (Security)', () => {
    it('should reject unauthenticated character creation', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/${projectId}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Unauthorized', description: 'Test' }),
      });
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated character list', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/${projectId}/characters`);
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated character view', async () => {
      const response = await fetch(
        `${BASE_URL}/api/projects/${projectId}/characters/${createdCharacterId}`
      );
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated character update', async () => {
      const response = await fetch(
        `${BASE_URL}/api/projects/${projectId}/characters/${createdCharacterId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Unauthorized' }),
        }
      );
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated character deletion', async () => {
      const response = await fetch(
        `${BASE_URL}/api/projects/${projectId}/characters/${createdCharacterId}`,
        { method: 'DELETE' }
      );
      expect(response.status).toBe(401);
    });
  });
});

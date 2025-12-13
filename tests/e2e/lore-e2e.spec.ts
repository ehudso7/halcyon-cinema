/**
 * E2E Journey Tests: Lore Management Flows
 *
 * Tests lore entry creation, viewing, filtering, updating, and deletion within projects.
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

describe('E2E Journey: Lore Management', () => {
  let session: AuthSession;
  let projectId: string;
  let createdLoreId: string;

  beforeAll(async () => {
    // Create authenticated session
    session = await createAuthenticatedSession('lore-test');

    // Create a project to add lore to
    const projectResponse = await authPost('/api/projects', session.cookies, {
      name: 'Lore Test Project',
      description: 'Project for lore E2E tests',
    });
    const project = await projectResponse.json();
    projectId = project.id;
  }, 30000);

  describe('Create Lore Flow', () => {
    it('should create a character lore entry', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/lore`,
        session.cookies,
        {
          type: 'character',
          name: 'The Shadow Broker',
          summary: 'A mysterious information dealer',
          description: 'Known only as the Shadow Broker, this enigmatic figure controls the flow of information in the underworld.',
          tags: ['mystery', 'villain', 'information'],
        }
      );

      expect(response.status).toBe(201);

      const lore = await response.json();
      expect(lore.id).toBeDefined();
      expect(lore.type).toBe('character');
      expect(lore.name).toBe('The Shadow Broker');
      expect(lore.summary).toBe('A mysterious information dealer');
      expect(lore.tags).toEqual(['mystery', 'villain', 'information']);

      createdLoreId = lore.id;
    });

    it('should create a location lore entry', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/lore`,
        session.cookies,
        {
          type: 'location',
          name: 'Neon District',
          summary: 'The entertainment hub of the city',
          description: 'A vibrant area filled with clubs, bars, and holographic advertisements.',
        }
      );

      expect(response.status).toBe(201);

      const lore = await response.json();
      expect(lore.type).toBe('location');
      expect(lore.name).toBe('Neon District');
    });

    it('should create an event lore entry', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/lore`,
        session.cookies,
        {
          type: 'event',
          name: 'The Great Blackout',
          summary: 'City-wide power failure in 2084',
          description: 'A catastrophic event that plunged the city into darkness for three days.',
        }
      );

      expect(response.status).toBe(201);

      const lore = await response.json();
      expect(lore.type).toBe('event');
    });

    it('should create a system lore entry', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/lore`,
        session.cookies,
        {
          type: 'system',
          name: 'Neural Interface Protocol',
          summary: 'Standard for brain-computer connections',
          description: 'The universal protocol governing all neural implant communications.',
        }
      );

      expect(response.status).toBe(201);

      const lore = await response.json();
      expect(lore.type).toBe('system');
    });

    it('should reject lore without type', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/lore`,
        session.cookies,
        {
          name: 'Missing Type',
          summary: 'No type provided',
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.toLowerCase()).toContain('type');
    });

    it('should reject lore without name', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/lore`,
        session.cookies,
        {
          type: 'character',
          summary: 'No name provided',
        }
      );

      expect(response.status).toBe(400);
    });

    it('should reject lore without summary', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/lore`,
        session.cookies,
        {
          type: 'character',
          name: 'No Summary Character',
        }
      );

      expect(response.status).toBe(400);
    });

    it('should reject invalid lore type', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/lore`,
        session.cookies,
        {
          type: 'invalid-type',
          name: 'Invalid Type Lore',
          summary: 'Has invalid type',
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.toLowerCase()).toContain('type');
    });

    it('should reject lore for non-existent project', async () => {
      const response = await authPost(
        '/api/projects/non-existent-id/lore',
        session.cookies,
        {
          type: 'character',
          name: 'Ghost Lore',
          summary: 'In a non-existent project',
        }
      );

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('Read Lore Flow', () => {
    it('should list all lore entries in a project', async () => {
      const response = await authGet(
        `/api/projects/${projectId}/lore`,
        session.cookies
      );

      expect(response.status).toBe(200);

      const loreEntries = await response.json();
      expect(Array.isArray(loreEntries)).toBe(true);
      expect(loreEntries.length).toBeGreaterThanOrEqual(4); // We created 4 entries
    });

    it('should filter lore by character type', async () => {
      const response = await authGet(
        `/api/projects/${projectId}/lore?type=character`,
        session.cookies
      );

      expect(response.status).toBe(200);

      const loreEntries = await response.json();
      expect(Array.isArray(loreEntries)).toBe(true);
      loreEntries.forEach((entry: { type: string }) => {
        expect(entry.type).toBe('character');
      });
    });

    it('should filter lore by location type', async () => {
      const response = await authGet(
        `/api/projects/${projectId}/lore?type=location`,
        session.cookies
      );

      expect(response.status).toBe(200);

      const loreEntries = await response.json();
      expect(loreEntries.length).toBeGreaterThanOrEqual(1);
      loreEntries.forEach((entry: { type: string }) => {
        expect(entry.type).toBe('location');
      });
    });

    it('should filter lore by event type', async () => {
      const response = await authGet(
        `/api/projects/${projectId}/lore?type=event`,
        session.cookies
      );

      expect(response.status).toBe(200);

      const loreEntries = await response.json();
      expect(loreEntries.length).toBeGreaterThanOrEqual(1);
      loreEntries.forEach((entry: { type: string }) => {
        expect(entry.type).toBe('event');
      });
    });

    it('should filter lore by system type', async () => {
      const response = await authGet(
        `/api/projects/${projectId}/lore?type=system`,
        session.cookies
      );

      expect(response.status).toBe(200);

      const loreEntries = await response.json();
      expect(loreEntries.length).toBeGreaterThanOrEqual(1);
      loreEntries.forEach((entry: { type: string }) => {
        expect(entry.type).toBe('system');
      });
    });

    it('should get a specific lore entry by ID', async () => {
      const response = await authGet(
        `/api/projects/${projectId}/lore/${createdLoreId}`,
        session.cookies
      );

      expect(response.status).toBe(200);

      const lore = await response.json();
      expect(lore.id).toBe(createdLoreId);
      expect(lore.name).toBe('The Shadow Broker');
    });

    it('should return 404 for non-existent lore', async () => {
      const response = await authGet(
        `/api/projects/${projectId}/lore/non-existent-id`,
        session.cookies
      );

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('Update Lore Flow', () => {
    it('should update lore name', async () => {
      const response = await authPut(
        `/api/projects/${projectId}/lore/${createdLoreId}`,
        session.cookies,
        { name: 'The Shadow Broker (Updated)' }
      );

      expect(response.status).toBe(200);

      const lore = await response.json();
      expect(lore.name).toBe('The Shadow Broker (Updated)');
    });

    it('should update lore summary', async () => {
      const response = await authPut(
        `/api/projects/${projectId}/lore/${createdLoreId}`,
        session.cookies,
        { summary: 'Updated: The most powerful information broker in the system' }
      );

      expect(response.status).toBe(200);

      const lore = await response.json();
      expect(lore.summary).toBe('Updated: The most powerful information broker in the system');
    });

    it('should update lore description', async () => {
      const response = await authPut(
        `/api/projects/${projectId}/lore/${createdLoreId}`,
        session.cookies,
        { description: 'Updated description with more details about the mysterious figure.' }
      );

      expect(response.status).toBe(200);

      const lore = await response.json();
      expect(lore.description).toBe('Updated description with more details about the mysterious figure.');
    });

    it('should update lore tags', async () => {
      const response = await authPut(
        `/api/projects/${projectId}/lore/${createdLoreId}`,
        session.cookies,
        { tags: ['updated', 'powerful', 'enigmatic'] }
      );

      expect(response.status).toBe(200);

      const lore = await response.json();
      expect(lore.tags).toEqual(['updated', 'powerful', 'enigmatic']);
    });
  });

  describe('Delete Lore Flow', () => {
    let loreToDelete: string;

    beforeAll(async () => {
      // Create a lore entry specifically to delete
      const response = await authPost(
        `/api/projects/${projectId}/lore`,
        session.cookies,
        {
          type: 'character',
          name: 'Lore To Delete',
          summary: 'Will be deleted in tests',
        }
      );
      const lore = await response.json();
      loreToDelete = lore.id;
    });

    it('should delete a lore entry', async () => {
      const response = await authDelete(
        `/api/projects/${projectId}/lore/${loreToDelete}`,
        session.cookies
      );

      expect(response.status).toBe(200);

      // Verify lore is gone
      const getResponse = await authGet(
        `/api/projects/${projectId}/lore/${loreToDelete}`,
        session.cookies
      );
      expect([401, 404]).toContain(getResponse.status);
    });

    it('should return 404 when deleting non-existent lore', async () => {
      const response = await authDelete(
        `/api/projects/${projectId}/lore/non-existent-id`,
        session.cookies
      );

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('Lore Isolation (Security)', () => {
    let otherSession: AuthSession;

    beforeAll(async () => {
      // Create another user
      otherSession = await createAuthenticatedSession('lore-other-user');
    }, 30000);

    it('should not allow another user to create lore in others project', async () => {
      const response = await authPost(
        `/api/projects/${projectId}/lore`,
        otherSession.cookies,
        {
          type: 'character',
          name: 'Unauthorized Lore',
          summary: 'Should not be created',
        }
      );

      expect([401, 403]).toContain(response.status);
    });

    it('should not allow another user to list lore', async () => {
      const response = await authGet(
        `/api/projects/${projectId}/lore`,
        otherSession.cookies
      );

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should not allow another user to view lore', async () => {
      const response = await authGet(
        `/api/projects/${projectId}/lore/${createdLoreId}`,
        otherSession.cookies
      );

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should not allow another user to update lore', async () => {
      const response = await authPut(
        `/api/projects/${projectId}/lore/${createdLoreId}`,
        otherSession.cookies,
        { name: 'Hacked Lore' }
      );

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should not allow another user to delete lore', async () => {
      const response = await authDelete(
        `/api/projects/${projectId}/lore/${createdLoreId}`,
        otherSession.cookies
      );

      expect([401, 403, 404]).toContain(response.status);
    });
  });

  describe('Unauthenticated Access (Security)', () => {
    it('should reject unauthenticated lore creation', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/${projectId}/lore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'character',
          name: 'Unauthorized',
          summary: 'Test',
        }),
      });
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated lore list', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/${projectId}/lore`);
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated lore view', async () => {
      const response = await fetch(
        `${BASE_URL}/api/projects/${projectId}/lore/${createdLoreId}`
      );
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated lore update', async () => {
      const response = await fetch(
        `${BASE_URL}/api/projects/${projectId}/lore/${createdLoreId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Unauthorized' }),
        }
      );
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated lore deletion', async () => {
      const response = await fetch(
        `${BASE_URL}/api/projects/${projectId}/lore/${createdLoreId}`,
        { method: 'DELETE' }
      );
      expect(response.status).toBe(401);
    });
  });
});

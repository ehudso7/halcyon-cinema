/**
 * E2E Journey Tests: Scene Management Flows
 *
 * Tests scene creation, viewing, updating, and deletion within projects.
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

describe('E2E Journey: Scene Management', () => {
  let session: AuthSession;
  let projectId: string;
  let createdSceneId: string;

  beforeAll(async () => {
    // Create authenticated session
    session = await createAuthenticatedSession('scene-test');

    // Create a project to add scenes to
    const projectResponse = await authPost('/api/projects', session.cookies, {
      name: 'Scene Test Project',
      description: 'Project for scene E2E tests',
    }, session.csrfToken);
    const project = await projectResponse.json();
    projectId = project.id;
  }, 30000);

  describe('Create Scene Flow', () => {
    it('should create a scene with prompt', async () => {
      const response = await authPost('/api/scenes', session.cookies, {
        projectId,
        prompt: 'A dramatic sunset over a cyberpunk city skyline',
      }, session.csrfToken);

      expect(response.status).toBe(201);

      const scene = await response.json();
      expect(scene.id).toBeDefined();
      expect(scene.prompt).toBe('A dramatic sunset over a cyberpunk city skyline');
      expect(scene.createdAt).toBeDefined();

      createdSceneId = scene.id;
    });

    it('should create a scene with prompt and imageUrl', async () => {
      const response = await authPost('/api/scenes', session.cookies, {
        projectId,
        prompt: 'A mysterious forest with glowing mushrooms',
        imageUrl: 'https://example.com/forest.png',
      }, session.csrfToken);

      expect(response.status).toBe(201);

      const scene = await response.json();
      expect(scene.prompt).toBe('A mysterious forest with glowing mushrooms');
      expect(scene.imageUrl).toBe('https://example.com/forest.png');
    });

    it('should create a scene with metadata', async () => {
      const response = await authPost('/api/scenes', session.cookies, {
        projectId,
        prompt: 'A spaceship docking at an orbital station',
        metadata: {
          style: 'sci-fi',
          mood: 'epic',
          cameraAngle: 'wide shot',
        },
      }, session.csrfToken);

      expect(response.status).toBe(201);

      const scene = await response.json();
      expect(scene.metadata).toBeDefined();
      expect(scene.metadata.style).toBe('sci-fi');
    });

    it('should reject scene without projectId', async () => {
      const response = await authPost('/api/scenes', session.cookies, {
        prompt: 'A scene without a project',
      }, session.csrfToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.toLowerCase()).toContain('project');
    });

    it('should reject scene without prompt', async () => {
      const response = await authPost('/api/scenes', session.cookies, {
        projectId,
      }, session.csrfToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.toLowerCase()).toContain('prompt');
    });

    it('should reject scene with empty prompt', async () => {
      const response = await authPost('/api/scenes', session.cookies, {
        projectId,
        prompt: '   ',
      }, session.csrfToken);

      expect(response.status).toBe(400);
    });

    it('should reject scene for non-existent project', async () => {
      const response = await authPost('/api/scenes', session.cookies, {
        projectId: 'non-existent-project-id',
        prompt: 'A scene for a missing project',
      }, session.csrfToken);

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('Read Scene Flow', () => {
    it('should get a specific scene by ID', async () => {
      const response = await authGet(
        `/api/scenes/${createdSceneId}?projectId=${projectId}`,
        session.cookies
      );

      expect(response.status).toBe(200);

      const scene = await response.json();
      expect(scene.id).toBe(createdSceneId);
      expect(scene.prompt).toBeDefined();
    });

    it('should get project with all its scenes', async () => {
      const response = await authGet(
        `/api/projects/${projectId}`,
        session.cookies
      );

      expect(response.status).toBe(200);

      const project = await response.json();
      expect(Array.isArray(project.scenes)).toBe(true);
      expect(project.scenes.length).toBeGreaterThanOrEqual(3); // We created 3 scenes
    });

    it('should return 404 for non-existent scene', async () => {
      const response = await authGet(
        `/api/scenes/non-existent-scene-id?projectId=${projectId}`,
        session.cookies
      );

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('Update Scene Flow', () => {
    it('should update scene prompt', async () => {
      const response = await authPut(
        `/api/scenes/${createdSceneId}?projectId=${projectId}`,
        session.cookies,
        { prompt: 'Updated: A neon-lit alley in the rain' },
        session.csrfToken
      );

      expect(response.status).toBe(200);

      const scene = await response.json();
      expect(scene.prompt).toBe('Updated: A neon-lit alley in the rain');
    });

    it('should update scene imageUrl', async () => {
      const response = await authPut(
        `/api/scenes/${createdSceneId}?projectId=${projectId}`,
        session.cookies,
        { imageUrl: 'https://example.com/updated-image.png' },
        session.csrfToken
      );

      expect(response.status).toBe(200);

      const scene = await response.json();
      expect(scene.imageUrl).toBe('https://example.com/updated-image.png');
    });

    it('should allow updating metadata', async () => {
      // API allows updating scene metadata
      const response = await authPut(
        `/api/scenes/${createdSceneId}?projectId=${projectId}`,
        session.cookies,
        { metadata: { style: 'noir', mood: 'mysterious' } },
        session.csrfToken
      );

      expect(response.status).toBe(200);

      // Verify the update was successful
      const scene = await response.json();
      expect(scene.metadata).toBeDefined();
      expect(scene.metadata.style).toBe('noir');
      expect(scene.metadata.mood).toBe('mysterious');
    });
  });

  describe('Delete Scene Flow', () => {
    let sceneToDelete: string;

    beforeAll(async () => {
      // Create a scene specifically to delete
      const response = await authPost('/api/scenes', session.cookies, {
        projectId,
        prompt: 'Scene to be deleted',
      }, session.csrfToken);
      const scene = await response.json();
      sceneToDelete = scene.id;
    });

    it('should delete a scene', async () => {
      const response = await authDelete(
        `/api/scenes/${sceneToDelete}?projectId=${projectId}`,
        session.cookies,
        session.csrfToken
      );

      expect(response.status).toBe(200);

      // Verify scene is gone
      const getResponse = await authGet(
        `/api/scenes/${sceneToDelete}?projectId=${projectId}`,
        session.cookies
      );
      expect([401, 404]).toContain(getResponse.status);
    });

    it('should return 404 when deleting non-existent scene', async () => {
      const response = await authDelete(
        `/api/scenes/non-existent-scene-id?projectId=${projectId}`,
        session.cookies,
        session.csrfToken
      );

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('Scene Isolation (Security)', () => {
    let otherSession: AuthSession;

    beforeAll(async () => {
      // Create another user
      otherSession = await createAuthenticatedSession('scene-other-user');
    }, 30000);

    it('should not allow another user to create scene in others project', async () => {
      const response = await authPost('/api/scenes', otherSession.cookies, {
        projectId,
        prompt: 'Unauthorized scene creation',
      }, otherSession.csrfToken);

      expect([401, 403]).toContain(response.status);
    });

    it('should not allow another user to view scene', async () => {
      const response = await authGet(
        `/api/scenes/${createdSceneId}?projectId=${projectId}`,
        otherSession.cookies
      );

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should not allow another user to update scene', async () => {
      const response = await authPut(
        `/api/scenes/${createdSceneId}?projectId=${projectId}`,
        otherSession.cookies,
        { prompt: 'Unauthorized update' },
        otherSession.csrfToken
      );

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should not allow another user to delete scene', async () => {
      const response = await authDelete(
        `/api/scenes/${createdSceneId}?projectId=${projectId}`,
        otherSession.cookies,
        otherSession.csrfToken
      );

      expect([401, 403, 404]).toContain(response.status);
    });
  });

  describe('Unauthenticated Access (Security)', () => {
    it('should reject unauthenticated scene creation', async () => {
      const response = await fetch(`${BASE_URL}/api/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, prompt: 'Unauthorized' }),
      });
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated scene view', async () => {
      const response = await fetch(`${BASE_URL}/api/scenes/${createdSceneId}?projectId=${projectId}`);
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated scene update', async () => {
      const response = await fetch(`${BASE_URL}/api/scenes/${createdSceneId}?projectId=${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Unauthorized update' }),
      });
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated scene deletion', async () => {
      const response = await fetch(`${BASE_URL}/api/scenes/${createdSceneId}?projectId=${projectId}`, {
        method: 'DELETE',
      });
      expect(response.status).toBe(401);
    });
  });
});

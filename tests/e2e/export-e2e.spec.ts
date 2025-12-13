/**
 * E2E Journey Tests: Export Flows
 *
 * Tests project and scene export functionality.
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
  AuthSession,
} from './helpers/auth-helper';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('E2E Journey: Export Flows', () => {
  let session: AuthSession;
  let projectId: string;
  let sceneId: string;

  beforeAll(async () => {
    // Create authenticated session
    session = await createAuthenticatedSession('export-test');

    // Create a project with content to export
    const projectResponse = await authPost('/api/projects', session.cookies, {
      name: 'Export Test Project',
      description: 'A project for testing export functionality',
    });
    const project = await projectResponse.json();
    projectId = project.id;

    // Add a scene to the project
    const sceneResponse = await authPost('/api/scenes', session.cookies, {
      projectId,
      prompt: 'A dramatic scene for export testing',
      imageUrl: 'https://example.com/test-image.png',
    });
    const scene = await sceneResponse.json();
    sceneId = scene.id;

    // Add a character
    await authPost(`/api/projects/${projectId}/characters`, session.cookies, {
      name: 'Test Character',
      description: 'A character for export testing',
      traits: ['brave', 'smart'],
    });

    // Add lore
    await authPost(`/api/projects/${projectId}/lore`, session.cookies, {
      type: 'location',
      name: 'Test Location',
      summary: 'A location for export testing',
    });
  }, 30000);

  describe('Project Export Flow', () => {
    it('should export a project as a ZIP file', async () => {
      const response = await authGet(
        `/api/export/project/${projectId}`,
        session.cookies
      );

      expect(response.status).toBe(200);

      // Verify content type is ZIP
      const contentType = response.headers.get('content-type');
      expect(contentType).toBe('application/zip');

      // Verify content disposition header
      const contentDisposition = response.headers.get('content-disposition');
      expect(contentDisposition).toContain('attachment');
      expect(contentDisposition).toContain('.zip');

      // Verify we got actual content
      const contentLength = response.headers.get('content-length');
      expect(parseInt(contentLength || '0')).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent project export', async () => {
      const response = await authGet(
        '/api/export/project/non-existent-id',
        session.cookies
      );

      expect([401, 404]).toContain(response.status);
    });

    it('should reject export of another user project', async () => {
      // Create another user
      const otherSession = await createAuthenticatedSession('export-other');

      const response = await authGet(
        `/api/export/project/${projectId}`,
        otherSession.cookies
      );

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should reject unauthenticated project export', async () => {
      const response = await fetch(`${BASE_URL}/api/export/project/${projectId}`);
      expect(response.status).toBe(401);
    });
  });

  describe('Scene Export Flow', () => {
    it('should export a scene as a ZIP file', async () => {
      const response = await authGet(
        `/api/export/scene/${sceneId}?projectId=${projectId}`,
        session.cookies
      );

      expect(response.status).toBe(200);

      // Verify content type is ZIP
      const contentType = response.headers.get('content-type');
      expect(contentType).toBe('application/zip');

      // Verify content disposition header
      const contentDisposition = response.headers.get('content-disposition');
      expect(contentDisposition).toContain('attachment');
      expect(contentDisposition).toContain('scene-');

      // Verify we got actual content
      const contentLength = response.headers.get('content-length');
      expect(parseInt(contentLength || '0')).toBeGreaterThan(0);
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await authGet(
        `/api/export/scene/${sceneId}`,
        session.cookies
      );

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent scene export', async () => {
      const response = await authGet(
        `/api/export/scene/non-existent-id?projectId=${projectId}`,
        session.cookies
      );

      expect([401, 404]).toContain(response.status);
    });

    it('should return 404 for non-existent project in scene export', async () => {
      const response = await authGet(
        `/api/export/scene/${sceneId}?projectId=non-existent-id`,
        session.cookies
      );

      expect([401, 404]).toContain(response.status);
    });

    it('should reject export of scene from another user project', async () => {
      // Create another user
      const otherSession = await createAuthenticatedSession('scene-export-other');

      const response = await authGet(
        `/api/export/scene/${sceneId}?projectId=${projectId}`,
        otherSession.cookies
      );

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should reject unauthenticated scene export', async () => {
      const response = await fetch(
        `${BASE_URL}/api/export/scene/${sceneId}?projectId=${projectId}`
      );
      expect(response.status).toBe(401);
    });
  });

  describe('Export Method Restrictions', () => {
    it('should reject POST to project export', async () => {
      const response = await authPost(
        `/api/export/project/${projectId}`,
        session.cookies,
        {}
      );

      expect(response.status).toBe(405);
    });

    it('should reject POST to scene export', async () => {
      const response = await authPost(
        `/api/export/scene/${sceneId}?projectId=${projectId}`,
        session.cookies,
        {}
      );

      expect(response.status).toBe(405);
    });
  });
});

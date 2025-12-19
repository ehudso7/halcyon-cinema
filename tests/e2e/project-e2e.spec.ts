/**
 * E2E Journey Tests: Project Management Flows
 *
 * Tests the complete project lifecycle: Create, Read, Update, Delete
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

describe('E2E Journey: Project Management', () => {
  let session: AuthSession;
  let createdProjectId: string;

  beforeAll(async () => {
    // Create authenticated session for all tests
    session = await createAuthenticatedSession('project-test');
  }, 30000);

  describe('Create Project Flow', () => {
    it('should create a new project with name and description', async () => {
      const response = await authPost('/api/projects', session.cookies, {
        name: 'Test Cinema Project',
        description: 'A test project for E2E testing',
      }, session.csrfToken);

      expect(response.status).toBe(201);

      const project = await response.json();
      expect(project.id).toBeDefined();
      expect(project.name).toBe('Test Cinema Project');
      expect(project.description).toBe('A test project for E2E testing');
      expect(project.userId).toBe(session.userId);
      expect(project.scenes).toEqual([]);
      expect(project.characters).toEqual([]);

      // Save for later tests
      createdProjectId = project.id;
    });

    it('should create a project with just a name', async () => {
      const response = await authPost('/api/projects', session.cookies, {
        name: 'Minimal Project',
      }, session.csrfToken);

      expect(response.status).toBe(201);

      const project = await response.json();
      expect(project.name).toBe('Minimal Project');
    });

    it('should reject project without name', async () => {
      const response = await authPost('/api/projects', session.cookies, {
        description: 'No name provided',
      }, session.csrfToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.toLowerCase()).toContain('name');
    });

    it('should reject project with empty name', async () => {
      const response = await authPost('/api/projects', session.cookies, {
        name: '   ',
        description: 'Empty name',
      }, session.csrfToken);

      expect(response.status).toBe(400);
    });
  });

  describe('Read Project Flow', () => {
    it('should list all user projects', async () => {
      const response = await authGet('/api/projects', session.cookies);

      expect(response.status).toBe(200);

      const projects = await response.json();
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThanOrEqual(2); // We created 2 projects

      // All projects should belong to the user
      projects.forEach((project: { userId: string }) => {
        expect(project.userId).toBe(session.userId);
      });
    });

    it('should get a specific project by ID', async () => {
      const response = await authGet(
        `/api/projects/${createdProjectId}`,
        session.cookies
      );

      expect(response.status).toBe(200);

      const project = await response.json();
      expect(project.id).toBe(createdProjectId);
      expect(project.name).toBe('Test Cinema Project');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await authGet(
        '/api/projects/non-existent-id',
        session.cookies
      );

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('Update Project Flow', () => {
    it('should update project name', async () => {
      const response = await authPut(
        `/api/projects/${createdProjectId}`,
        session.cookies,
        { name: 'Updated Project Name' },
        session.csrfToken
      );

      expect(response.status).toBe(200);

      const project = await response.json();
      expect(project.name).toBe('Updated Project Name');
    });

    it('should update project description', async () => {
      const response = await authPut(
        `/api/projects/${createdProjectId}`,
        session.cookies,
        { description: 'Updated description' },
        session.csrfToken
      );

      expect(response.status).toBe(200);

      const project = await response.json();
      expect(project.description).toBe('Updated description');
    });

    it('should reject update with empty name', async () => {
      const response = await authPut(
        `/api/projects/${createdProjectId}`,
        session.cookies,
        { name: '' },
        session.csrfToken
      );

      expect(response.status).toBe(400);
    });
  });

  describe('Delete Project Flow', () => {
    let projectToDelete: string;

    beforeAll(async () => {
      // Create a project specifically to delete
      const response = await authPost('/api/projects', session.cookies, {
        name: 'Project To Delete',
      }, session.csrfToken);
      const project = await response.json();
      projectToDelete = project.id;
    });

    it('should delete a project', async () => {
      const response = await authDelete(
        `/api/projects/${projectToDelete}`,
        session.cookies,
        session.csrfToken
      );

      expect(response.status).toBe(200);

      // Verify project is gone
      const getResponse = await authGet(
        `/api/projects/${projectToDelete}`,
        session.cookies
      );
      expect([401, 404]).toContain(getResponse.status);
    });

    it('should return 404 when deleting non-existent project', async () => {
      const response = await authDelete(
        '/api/projects/non-existent-id',
        session.cookies,
        session.csrfToken
      );

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('Project Isolation (Security)', () => {
    let otherSession: AuthSession;
    let isolatedProjectId: string;

    beforeAll(async () => {
      // Create another user
      otherSession = await createAuthenticatedSession('other-user');

      // Create a project with the original user
      const response = await authPost('/api/projects', session.cookies, {
        name: 'Isolated Project',
      }, session.csrfToken);
      const project = await response.json();
      isolatedProjectId = project.id;
    }, 30000);

    it('should not allow another user to view the project', async () => {
      const response = await authGet(
        `/api/projects/${isolatedProjectId}`,
        otherSession.cookies
      );

      // Should be 404 or 403 - project not visible to other user
      expect([401, 403, 404]).toContain(response.status);
    });

    it('should not allow another user to update the project', async () => {
      const response = await authPut(
        `/api/projects/${isolatedProjectId}`,
        otherSession.cookies,
        { name: 'Hacked Name' },
        otherSession.csrfToken
      );

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should not allow another user to delete the project', async () => {
      const response = await authDelete(
        `/api/projects/${isolatedProjectId}`,
        otherSession.cookies,
        otherSession.csrfToken
      );

      expect([401, 403, 404]).toContain(response.status);
    });

    it('other user projects list should not include original user projects', async () => {
      const response = await authGet('/api/projects', otherSession.cookies);
      const projects = await response.json();

      const projectIds = projects.map((p: { id: string }) => p.id);
      expect(projectIds).not.toContain(isolatedProjectId);
    });
  });

  describe('Unauthenticated Access (Security)', () => {
    it('should reject unauthenticated project list', async () => {
      const response = await fetch(`${BASE_URL}/api/projects`);
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated project creation', async () => {
      const response = await fetch(`${BASE_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Unauthorized Project' }),
      });
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated project update', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/${createdProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Unauthorized Update' }),
      });
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated project deletion', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/${createdProjectId}`, {
        method: 'DELETE',
      });
      expect(response.status).toBe(401);
    });
  });
});

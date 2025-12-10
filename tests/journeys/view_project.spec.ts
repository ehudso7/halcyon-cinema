/**
 * Journey: view_project - View Project Details
 * Tags: [project, critical]
 *
 * Tests viewing project details via the /api/projects/[projectId] endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mock the storage module
vi.mock('@/utils/storage', () => ({
  getProjectByIdAsync: vi.fn(),
  updateProjectAsync: vi.fn(),
  deleteProjectAsync: vi.fn(),
}));

// Mock the api-auth module
vi.mock('@/utils/api-auth', () => ({
  requireAuth: vi.fn(),
}));

import handler from '@/pages/api/projects/[projectId]';
import { getProjectByIdAsync } from '@/utils/storage';
import { requireAuth } from '@/utils/api-auth';

describe('Journey: view_project - View Project Details', () => {
  let mockReq: Partial<NextApiRequest>;
  let mockRes: {
    statusCode: number;
    data: unknown;
    headers: Record<string, string>;
    status: (code: number) => typeof mockRes;
    json: (data: unknown) => typeof mockRes;
    setHeader: (key: string, value: string) => typeof mockRes;
    end: () => typeof mockRes;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      method: 'GET',
      query: { projectId: 'project-123' },
    };

    mockRes = {
      statusCode: 200,
      data: null,
      headers: {},
      status: function (code: number) {
        this.statusCode = code;
        return this;
      },
      json: function (data: unknown) {
        this.data = data;
        return this;
      },
      setHeader: function (key: string, value: string) {
        this.headers[key] = value;
        return this;
      },
      end: function () {
        return this;
      },
    };
  });

  it('should return project details for authenticated user', async () => {
    // Preconditions: User is authenticated, Project exists for user
    vi.mocked(requireAuth).mockResolvedValue('user-123');

    const mockProject = {
      id: 'project-123',
      userId: 'user-123',
      name: 'Test Project',
      description: 'A test project',
      scenes: [
        { id: 'scene-1', prompt: 'A sunset scene', projectId: 'project-123', imageUrl: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'scene-2', prompt: 'A forest scene', projectId: 'project-123', imageUrl: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
      characters: [
        { id: 'char-1', name: 'Hero', projectId: 'project-123', description: 'The main hero', traits: [], appearances: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
      lore: [],
      sequences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);

    // Steps: Navigate to /project/[projectId]
    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    // Expected: Project details are displayed
    expect(mockRes.statusCode).toBe(200);

    const data = mockRes.data as typeof mockProject;
    expect(data.id).toBe('project-123');
    expect(data.name).toBe('Test Project');

    // Expected: Scenes list is shown
    expect(data.scenes).toHaveLength(2);
    expect(data.scenes[0].prompt).toBe('A sunset scene');

    // Expected: Characters available
    expect(data.characters).toHaveLength(1);
  });

  it('should return 404 for non-existent project', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');
    vi.mocked(getProjectByIdAsync).mockResolvedValue(null);

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(404);
    const data = mockRes.data as { error: string };
    expect(data.error).toBe('Project not found');
  });

  it('should return 403 when accessing another users project', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');

    const otherUsersProject = {
      id: 'project-123',
      userId: 'different-user-456',
      name: 'Other Users Project',
      scenes: [],
      characters: [],
      lore: [],
      sequences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(getProjectByIdAsync).mockResolvedValue(otherUsersProject);

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(403);
    const data = mockRes.data as { error: string };
    expect(data.error).toBe('Forbidden');
  });

  it('should return 401 for unauthenticated requests', async () => {
    vi.mocked(requireAuth).mockImplementation(async (_req, res) => {
      (res as unknown as typeof mockRes).status(401).json({ error: 'Unauthorized' });
      return null;
    });

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(401);
  });

  it('should return 400 for missing projectId', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');
    mockReq.query = {};

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(400);
    const data = mockRes.data as { error: string };
    expect(data.error).toBe('Invalid project ID');
  });
});

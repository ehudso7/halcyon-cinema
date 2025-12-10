/**
 * Journey: create_project - Create New Project
 * Tags: [project, critical]
 *
 * Tests the project creation flow via the /api/projects endpoint.
 * Verifies that authenticated users can create projects with proper validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mock the storage module
vi.mock('@/utils/storage', () => ({
  getAllProjectsAsync: vi.fn(),
  createProjectAsync: vi.fn(),
}));

// Mock the api-auth module
vi.mock('@/utils/api-auth', () => ({
  requireAuth: vi.fn(),
}));

import handler from '@/pages/api/projects/index';
import { createProjectAsync } from '@/utils/storage';
import { requireAuth } from '@/utils/api-auth';

describe('Journey: create_project - Create New Project', () => {
  let mockReq: Partial<NextApiRequest>;
  let mockRes: {
    statusCode: number;
    data: unknown;
    headers: Record<string, string>;
    status: (code: number) => typeof mockRes;
    json: (data: unknown) => typeof mockRes;
    setHeader: (key: string, value: string) => typeof mockRes;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      method: 'POST',
      body: {},
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
    };
  });

  it('should successfully create a new project for authenticated user', async () => {
    // Precondition: User is authenticated
    vi.mocked(requireAuth).mockResolvedValue('user-123');

    const mockProject = {
      id: 'project-456',
      userId: 'user-123',
      name: 'My New Project',
      description: 'A test project',
      scenes: [],
      characters: [],
      lore: [],
      sequences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(createProjectAsync).mockResolvedValue(mockProject);

    // Steps: Enter project name and description, submit
    mockReq.body = {
      name: 'My New Project',
      description: 'A test project',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    // Expected: Project is created in database (201 status)
    expect(mockRes.statusCode).toBe(201);

    // Expected: Project data is returned with unique ID
    const data = mockRes.data as typeof mockProject;
    expect(data.id).toBe('project-456');
    expect(data.name).toBe('My New Project');
    expect(data.description).toBe('A test project');
    expect(data.userId).toBe('user-123');

    // Verify createProjectAsync was called with correct params
    expect(createProjectAsync).toHaveBeenCalledWith(
      'My New Project',
      'A test project',
      'user-123'
    );
  });

  it('should create project with name only (no description)', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');

    const mockProject = {
      id: 'project-789',
      userId: 'user-123',
      name: 'Minimal Project',
      description: undefined,
      scenes: [],
      characters: [],
      lore: [],
      sequences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(createProjectAsync).mockResolvedValue(mockProject);

    mockReq.body = {
      name: 'Minimal Project',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(201);
    expect(createProjectAsync).toHaveBeenCalledWith(
      'Minimal Project',
      undefined,
      'user-123'
    );
  });

  it('should reject project creation without name', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');

    mockReq.body = {
      description: 'Only description, no name',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(400);
    const data = mockRes.data as { error: string };
    expect(data.error).toBe('Project name is required');
  });

  it('should reject project creation with empty name', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');

    mockReq.body = {
      name: '   ',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(400);
    const data = mockRes.data as { error: string };
    expect(data.error).toBe('Project name is required');
  });

  it('should reject project creation for unauthenticated user', async () => {
    // Precondition: User is not authenticated
    vi.mocked(requireAuth).mockImplementation(async (_req, res) => {
      (res as unknown as typeof mockRes).status(401).json({ error: 'Unauthorized' });
      return null;
    });

    mockReq.body = {
      name: 'Test Project',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    // Expected: Unauthorized error
    expect(mockRes.statusCode).toBe(401);
    const data = mockRes.data as { error: string };
    expect(data.error).toBe('Unauthorized');

    // createProjectAsync should not be called
    expect(createProjectAsync).not.toHaveBeenCalled();
  });

  it('should trim whitespace from project name and description', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');

    const mockProject = {
      id: 'project-abc',
      userId: 'user-123',
      name: 'Trimmed Name',
      description: 'Trimmed Description',
      scenes: [],
      characters: [],
      lore: [],
      sequences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(createProjectAsync).mockResolvedValue(mockProject);

    mockReq.body = {
      name: '  Trimmed Name  ',
      description: '  Trimmed Description  ',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(201);
    expect(createProjectAsync).toHaveBeenCalledWith(
      'Trimmed Name',
      'Trimmed Description',
      'user-123'
    );
  });

  it('should return 500 for database errors', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');
    vi.mocked(createProjectAsync).mockRejectedValue(new Error('Database error'));

    mockReq.body = {
      name: 'Test Project',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(500);
    const data = mockRes.data as { error: string };
    expect(data.error).toBe('Failed to create project');
  });
});

/**
 * Journey: create_lore - Create Lore Entry in Project
 * Tags: [lore]
 *
 * Tests lore entry creation via the /api/projects/[projectId]/lore endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

vi.mock('@/utils/storage', () => ({
  getProjectByIdAsync: vi.fn(),
  addLoreToProjectAsync: vi.fn(),
  getProjectLoreAsync: vi.fn(),
}));

vi.mock('@/utils/api-auth', () => ({
  requireAuth: vi.fn(),
}));

import handler from '@/pages/api/projects/[projectId]/lore/index';
import { getProjectByIdAsync, addLoreToProjectAsync } from '@/utils/storage';
import { requireAuth } from '@/utils/api-auth';

describe('Journey: create_lore - Create Lore Entry in Project', () => {
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
      query: { projectId: 'project-123' },
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

  it('should successfully create lore entry with type, name, and summary', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');

    const mockProject = {
      id: 'project-123',
      userId: 'user-123',
      name: 'Test Project',
      scenes: [],
      characters: [],
      lore: [],
      sequences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockLore = {
      id: 'lore-789',
      projectId: 'project-123',
      type: 'location',
      name: 'Ancient Temple',
      summary: 'A mysterious temple in the mountains',
      description: 'Detailed description of the temple',
      tags: ['ancient', 'mysterious'],
      associatedScenes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);
    vi.mocked(addLoreToProjectAsync).mockResolvedValue(mockLore);

    mockReq.body = {
      type: 'location',
      name: 'Ancient Temple',
      summary: 'A mysterious temple in the mountains',
      description: 'Detailed description of the temple',
      tags: ['ancient', 'mysterious'],
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    // Expected: Lore entry is created (201 status)
    expect(mockRes.statusCode).toBe(201);

    const data = mockRes.data as typeof mockLore;
    expect(data.id).toBe('lore-789');
    expect(data.type).toBe('location');
    expect(data.name).toBe('Ancient Temple');
    expect(data.summary).toBe('A mysterious temple in the mountains');
  });

  it('should reject lore creation without required fields', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');

    const mockProject = {
      id: 'project-123',
      userId: 'user-123',
      name: 'Test Project',
      scenes: [],
      characters: [],
      lore: [],
      sequences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);

    mockReq.body = {
      name: 'Incomplete Lore',
      // Missing type and summary
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(400);
  });

  it('should reject lore creation for non-owned project', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');

    const otherUsersProject = {
      id: 'project-123',
      userId: 'different-user',
      name: 'Other Project',
      scenes: [],
      characters: [],
      lore: [],
      sequences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(getProjectByIdAsync).mockResolvedValue(otherUsersProject);

    mockReq.body = {
      type: 'location',
      name: 'Test Lore',
      summary: 'Test summary',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(403);
  });

  it('should reject unauthenticated requests', async () => {
    vi.mocked(requireAuth).mockImplementation(async (_req, res) => {
      (res as typeof mockRes).status(401).json({ error: 'Unauthorized' });
      return null;
    });

    mockReq.body = {
      type: 'location',
      name: 'Test Lore',
      summary: 'Test',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(401);
  });
});

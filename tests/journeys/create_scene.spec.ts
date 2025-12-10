/**
 * Journey: create_scene - Create Scene in Project
 * Tags: [scene, critical]
 *
 * Tests scene creation via the /api/scenes endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

vi.mock('@/utils/storage', () => ({
  getProjectByIdAsync: vi.fn(),
  addSceneToProjectAsync: vi.fn(),
}));

vi.mock('@/utils/api-auth', () => ({
  requireAuth: vi.fn(),
}));

import handler from '@/pages/api/scenes/index';
import { getProjectByIdAsync, addSceneToProjectAsync } from '@/utils/storage';
import { requireAuth } from '@/utils/api-auth';

describe('Journey: create_scene - Create Scene in Project', () => {
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

  it('should successfully create a scene with prompt', async () => {
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

    const mockScene = {
      id: 'scene-456',
      projectId: 'project-123',
      prompt: 'A dramatic sunset over mountains',
      imageUrl: null,
      metadata: {
        shotType: 'wide',
        style: 'cinematic',
        lighting: 'golden hour',
        mood: 'dramatic',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);
    vi.mocked(addSceneToProjectAsync).mockResolvedValue(mockScene);

    mockReq.body = {
      projectId: 'project-123',
      prompt: 'A dramatic sunset over mountains',
      metadata: {
        shotType: 'wide',
        style: 'cinematic',
        lighting: 'golden hour',
        mood: 'dramatic',
      },
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    // Expected: Scene is created with prompt (201 status)
    expect(mockRes.statusCode).toBe(201);

    const data = mockRes.data as typeof mockScene;
    expect(data.id).toBe('scene-456');
    expect(data.prompt).toBe('A dramatic sunset over mountains');
    expect(data.projectId).toBe('project-123');

    // Verify metadata is passed
    expect(addSceneToProjectAsync).toHaveBeenCalledWith(
      'project-123',
      'A dramatic sunset over mountains',
      null,
      expect.objectContaining({
        shotType: 'wide',
        style: 'cinematic',
      }),
      undefined
    );
  });

  it('should reject scene creation without prompt', async () => {
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
      projectId: 'project-123',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(400);
    const data = mockRes.data as { error: string };
    expect(data.error.toLowerCase()).toContain('prompt');
  });

  it('should reject scene creation without projectId', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');

    mockReq.body = {
      prompt: 'A scene prompt',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(400);
  });

  it('should reject scene creation for non-owned project', async () => {
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
      projectId: 'project-123',
      prompt: 'A scene prompt',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(403);
  });

  it('should return 401 for unauthenticated requests', async () => {
    vi.mocked(requireAuth).mockImplementation(async (_req, res) => {
      (res as unknown as typeof mockRes).status(401).json({ error: 'Unauthorized' });
      return null;
    });

    mockReq.body = {
      projectId: 'project-123',
      prompt: 'A scene prompt',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(401);
  });
});

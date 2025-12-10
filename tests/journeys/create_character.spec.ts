/**
 * Journey: create_character - Create Character in Project
 * Tags: [character]
 *
 * Tests character creation via the /api/projects/[projectId]/characters endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

vi.mock('@/utils/storage', () => ({
  getProjectByIdAsync: vi.fn(),
  addCharacterToProjectAsync: vi.fn(),
}));

vi.mock('@/utils/api-auth', () => ({
  requireAuth: vi.fn(),
}));

import handler from '@/pages/api/projects/[projectId]/characters/index';
import { getProjectByIdAsync, addCharacterToProjectAsync } from '@/utils/storage';
import { requireAuth } from '@/utils/api-auth';

describe('Journey: create_character - Create Character in Project', () => {
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

  it('should successfully create character with name and description', async () => {
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

    const mockCharacter = {
      id: 'char-456',
      projectId: 'project-123',
      name: 'Hero Character',
      description: 'A brave protagonist',
      traits: ['brave', 'determined'],
      appearances: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);
    vi.mocked(addCharacterToProjectAsync).mockResolvedValue(mockCharacter);

    mockReq.body = {
      name: 'Hero Character',
      description: 'A brave protagonist',
      traits: ['brave', 'determined'],
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    // Expected: Character is created (201 status)
    expect(mockRes.statusCode).toBe(201);

    const data = mockRes.data as typeof mockCharacter;
    expect(data.id).toBe('char-456');
    expect(data.name).toBe('Hero Character');
    expect(data.description).toBe('A brave protagonist');
    expect(data.traits).toContain('brave');
  });

  it('should reject character creation without name', async () => {
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
      description: 'A character without a name',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(400);
    const data = mockRes.data as { error: string };
    expect(data.error.toLowerCase()).toContain('name');
  });

  it('should reject character creation for non-owned project', async () => {
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
      name: 'Test Character',
      description: 'Test',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(403);
  });

  it('should reject unauthenticated requests', async () => {
    vi.mocked(requireAuth).mockImplementation(async (_req, res) => {
      (res as unknown as typeof mockRes).status(401).json({ error: 'Unauthorized' });
      return null;
    });

    mockReq.body = {
      name: 'Test Character',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(401);
  });
});

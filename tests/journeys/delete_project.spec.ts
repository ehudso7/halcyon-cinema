/**
 * Journey: delete_project - Delete Project
 * Tags: [project]
 *
 * Tests project deletion via the /api/projects/[projectId] endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

vi.mock('@/utils/storage', () => ({
  getProjectByIdAsync: vi.fn(),
  updateProjectAsync: vi.fn(),
  deleteProjectAsync: vi.fn(),
}));

vi.mock('@/utils/api-auth', () => ({
  requireAuth: vi.fn(),
}));

import handler from '@/pages/api/projects/[projectId]';
import { getProjectByIdAsync, deleteProjectAsync } from '@/utils/storage';
import { requireAuth } from '@/utils/api-auth';

describe('Journey: delete_project - Delete Project', () => {
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
      method: 'DELETE',
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

  it('should successfully delete project for owner', async () => {
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
    vi.mocked(deleteProjectAsync).mockResolvedValue(true);

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    // Expected: Project is removed from database (200 with success)
    expect(mockRes.statusCode).toBe(200);
    const data = mockRes.data as { success: boolean };
    expect(data.success).toBe(true);
    expect(deleteProjectAsync).toHaveBeenCalledWith('project-123');
  });

  it('should return 404 when deleting non-existent project', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');
    vi.mocked(getProjectByIdAsync).mockResolvedValue(null);

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(404);
  });

  it('should return 403 when deleting another users project', async () => {
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

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(403);
    expect(deleteProjectAsync).not.toHaveBeenCalled();
  });
});

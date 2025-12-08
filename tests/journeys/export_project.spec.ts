/**
 * Journey: export_project - Export Project Data
 * Tags: [export]
 *
 * Tests project export via the /api/export/project/[id] endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mock the storage module - export API uses sync getProjectById
vi.mock('@/utils/storage', () => ({
  getProjectById: vi.fn(),
}));

// Mock export utility
vi.mock('@/utils/export', () => ({
  exportProjectAsZip: vi.fn(),
}));

vi.mock('@/utils/api-auth', () => ({
  requireAuth: vi.fn(),
}));

import handler from '@/pages/api/export/project/[id]';
import { getProjectById } from '@/utils/storage';
import { exportProjectAsZip } from '@/utils/export';
import { requireAuth } from '@/utils/api-auth';

describe('Journey: export_project - Export Project Data', () => {
  let mockReq: Partial<NextApiRequest>;
  let mockRes: {
    statusCode: number;
    data: unknown;
    headers: Record<string, string>;
    status: (code: number) => typeof mockRes;
    json: (data: unknown) => typeof mockRes;
    setHeader: (key: string, value: string) => typeof mockRes;
    send: (data: unknown) => typeof mockRes;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      method: 'GET',
      query: { id: 'project-123' },
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
      send: function (data: unknown) {
        this.data = data;
        return this;
      },
    };
  });

  it('should export project data for owner', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');

    const mockProject = {
      id: 'project-123',
      userId: 'user-123',
      name: 'Export Test Project',
      scenes: [
        { id: 'scene-1', prompt: 'Scene 1', projectId: 'project-123' },
        { id: 'scene-2', prompt: 'Scene 2', projectId: 'project-123' },
      ],
      characters: [],
      lore: [],
      sequences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockZipBuffer = Buffer.from('mock-zip-data');

    vi.mocked(getProjectById).mockReturnValue(mockProject);
    vi.mocked(exportProjectAsZip).mockResolvedValue(mockZipBuffer);

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    // Expected: Project data is exported (ZIP response)
    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.headers['Content-Type']).toBe('application/zip');
    expect(mockRes.headers['Content-Disposition']).toContain('export-test-project');
    expect(exportProjectAsZip).toHaveBeenCalledWith(mockProject);
  });

  it('should return 404 for non-existent project', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');
    vi.mocked(getProjectById).mockReturnValue(null);

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(404);
  });

  it('should return 403 when exporting another users project', async () => {
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

    vi.mocked(getProjectById).mockReturnValue(otherUsersProject);

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

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(401);
  });

  it('should return 500 when export fails', async () => {
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

    vi.mocked(getProjectById).mockReturnValue(mockProject);
    vi.mocked(exportProjectAsZip).mockRejectedValue(new Error('Export failed'));

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(500);
    const data = mockRes.data as { error: string };
    expect(data.error).toBe('Failed to export project');
  });
});

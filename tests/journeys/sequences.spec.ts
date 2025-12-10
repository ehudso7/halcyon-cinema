/**
 * Journey: sequences - Sequence CRUD Operations
 * Tags: [sequence, critical]
 *
 * Tests sequence management via the /api/projects/[projectId]/sequences endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

vi.mock('@/utils/storage', () => ({
  getProjectByIdAsync: vi.fn(),
  getProjectSequencesAsync: vi.fn(),
  addSequenceToProjectAsync: vi.fn(),
  updateSequenceAsync: vi.fn(),
  deleteSequenceAsync: vi.fn(),
}));

vi.mock('@/utils/api-auth', () => ({
  requireAuth: vi.fn(),
}));

import sequencesHandler from '@/pages/api/projects/[projectId]/sequences/index';
import sequenceHandler from '@/pages/api/projects/[projectId]/sequences/[sequenceId]';
import {
  getProjectByIdAsync,
  getProjectSequencesAsync,
  addSequenceToProjectAsync,
  updateSequenceAsync,
  deleteSequenceAsync,
} from '@/utils/storage';
import { requireAuth } from '@/utils/api-auth';

describe('Journey: sequences - Sequence CRUD Operations', () => {
  let mockReq: Partial<NextApiRequest>;
  let mockRes: {
    statusCode: number;
    data: unknown;
    headers: Record<string, string>;
    status: (code: number) => typeof mockRes;
    json: (data: unknown) => typeof mockRes;
    setHeader: (key: string, value: string) => typeof mockRes;
  };

  const mockProject = {
    id: 'project-123',
    userId: 'user-123',
    name: 'Test Project',
    scenes: [
      { id: 'scene-1', projectId: 'project-123', prompt: 'Scene 1', imageUrl: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'scene-2', projectId: 'project-123', prompt: 'Scene 2', imageUrl: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ],
    characters: [],
    lore: [],
    sequences: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockSequence = {
    id: 'seq-456',
    projectId: 'project-123',
    name: 'Main Sequence',
    description: 'Test sequence',
    shots: [
      { sceneId: 'scene-1', order: 0, title: 'Shot 1', duration: 5, transitionType: 'cut' as const },
      { sceneId: 'scene-2', order: 1, title: 'Shot 2', duration: 5, transitionType: 'fade' as const },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      method: 'GET',
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

  describe('GET /api/projects/[projectId]/sequences', () => {
    it('should return all sequences for a project', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);
      vi.mocked(getProjectSequencesAsync).mockResolvedValue([mockSequence]);

      mockReq.method = 'GET';

      await sequencesHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(200);
      const data = mockRes.data as typeof mockSequence[];
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Main Sequence');
    });

    it('should return empty array when no sequences exist', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);
      vi.mocked(getProjectSequencesAsync).mockResolvedValue([]);

      mockReq.method = 'GET';

      await sequencesHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(200);
      expect(mockRes.data).toEqual([]);
    });

    it('should reject requests for non-owned projects', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue({
        ...mockProject,
        userId: 'different-user',
      });

      mockReq.method = 'GET';

      await sequencesHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(403);
    });
  });

  describe('POST /api/projects/[projectId]/sequences', () => {
    it('should create a new sequence with shots', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);
      vi.mocked(addSequenceToProjectAsync).mockResolvedValue(mockSequence);

      mockReq.method = 'POST';
      mockReq.body = {
        name: 'Main Sequence',
        description: 'Test sequence',
        shots: mockSequence.shots,
      };

      await sequencesHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(201);
      const data = mockRes.data as typeof mockSequence;
      expect(data.name).toBe('Main Sequence');
      expect(data.shots).toHaveLength(2);
    });

    it('should reject sequence creation without name', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);

      mockReq.method = 'POST';
      mockReq.body = {
        description: 'Test sequence',
      };

      await sequencesHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(400);
      const data = mockRes.data as { error: string };
      expect(data.error.toLowerCase()).toContain('name');
    });

    it('should reject sequence creation with invalid shots array', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);

      mockReq.method = 'POST';
      mockReq.body = {
        name: 'Main Sequence',
        shots: 'not-an-array',
      };

      await sequencesHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(400);
      const data = mockRes.data as { error: string };
      expect(data.error.toLowerCase()).toContain('array');
    });

    it('should reject sequence creation with invalid shot structure', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);

      mockReq.method = 'POST';
      mockReq.body = {
        name: 'Main Sequence',
        shots: [{ invalidField: 'test' }],
      };

      await sequencesHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(400);
      const data = mockRes.data as { error: string };
      expect(data.error.toLowerCase()).toContain('sceneid');
    });
  });

  describe('GET /api/projects/[projectId]/sequences/[sequenceId]', () => {
    it('should return a single sequence', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);
      vi.mocked(getProjectSequencesAsync).mockResolvedValue([mockSequence]);

      mockReq.method = 'GET';
      mockReq.query = { projectId: 'project-123', sequenceId: 'seq-456' };

      await sequenceHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(200);
      const data = mockRes.data as typeof mockSequence;
      expect(data.id).toBe('seq-456');
      expect(data.name).toBe('Main Sequence');
    });

    it('should return 404 for non-existent sequence', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);
      vi.mocked(getProjectSequencesAsync).mockResolvedValue([]);

      mockReq.method = 'GET';
      mockReq.query = { projectId: 'project-123', sequenceId: 'non-existent' };

      await sequenceHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(404);
    });
  });

  describe('PUT /api/projects/[projectId]/sequences/[sequenceId]', () => {
    it('should update an existing sequence', async () => {
      const updatedSequence = {
        ...mockSequence,
        name: 'Updated Sequence',
        shots: [{ sceneId: 'scene-1', order: 0, title: 'New Shot', duration: 10, transitionType: 'dissolve' as const }],
      };

      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);
      vi.mocked(updateSequenceAsync).mockResolvedValue(updatedSequence);

      mockReq.method = 'PUT';
      mockReq.query = { projectId: 'project-123', sequenceId: 'seq-456' };
      mockReq.body = {
        name: 'Updated Sequence',
        shots: updatedSequence.shots,
      };

      await sequenceHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(200);
      const data = mockRes.data as typeof updatedSequence;
      expect(data.name).toBe('Updated Sequence');
    });

    it('should return 404 when updating non-existent sequence', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);
      vi.mocked(updateSequenceAsync).mockResolvedValue(null);

      mockReq.method = 'PUT';
      mockReq.query = { projectId: 'project-123', sequenceId: 'non-existent' };
      mockReq.body = { name: 'Updated Sequence' };

      await sequenceHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(404);
    });

    it('should reject update with invalid shots array', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);

      mockReq.method = 'PUT';
      mockReq.query = { projectId: 'project-123', sequenceId: 'seq-456' };
      mockReq.body = {
        name: 'Updated Sequence',
        shots: 'invalid',
      };

      await sequenceHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/projects/[projectId]/sequences/[sequenceId]', () => {
    it('should delete an existing sequence', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);
      vi.mocked(deleteSequenceAsync).mockResolvedValue(true);

      mockReq.method = 'DELETE';
      mockReq.query = { projectId: 'project-123', sequenceId: 'seq-456' };

      await sequenceHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(200);
      const data = mockRes.data as { success: boolean };
      expect(data.success).toBe(true);
    });

    it('should return 404 when deleting non-existent sequence', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);
      vi.mocked(deleteSequenceAsync).mockResolvedValue(false);

      mockReq.method = 'DELETE';
      mockReq.query = { projectId: 'project-123', sequenceId: 'non-existent' };

      await sequenceHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(404);
    });
  });

  describe('Authentication', () => {
    it('should return 401 for unauthenticated requests', async () => {
      vi.mocked(requireAuth).mockImplementation(async (_req, res) => {
        (res as typeof mockRes).status(401).json({ error: 'Unauthorized' });
        return null;
      });

      mockReq.method = 'GET';

      await sequencesHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(401);
    });
  });

  describe('Method Handling', () => {
    it('should return 405 for unsupported methods on collection endpoint', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);

      mockReq.method = 'DELETE';

      await sequencesHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(405);
      expect(mockRes.headers['Allow']).toEqual(['GET', 'POST']);
    });

    it('should return 405 for unsupported methods on individual endpoint', async () => {
      vi.mocked(requireAuth).mockResolvedValue('user-123');
      vi.mocked(getProjectByIdAsync).mockResolvedValue(mockProject);

      mockReq.method = 'POST';
      mockReq.query = { projectId: 'project-123', sequenceId: 'seq-456' };

      await sequenceHandler(
        mockReq as NextApiRequest,
        mockRes as unknown as NextApiResponse
      );

      expect(mockRes.statusCode).toBe(405);
      expect(mockRes.headers['Allow']).toEqual(['GET', 'PUT', 'DELETE']);
    });
  });
});

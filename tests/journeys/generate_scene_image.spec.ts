/**
 * Journey: generate_scene_image - Generate AI Image for Scene
 * Tags: [scene, ai, critical]
 *
 * Tests AI image generation via the /api/generate-image endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

vi.mock('@/utils/api-auth', () => ({
  requireAuth: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('@/utils/openai', () => ({
  generateImage: vi.fn(),
  buildCinematicPrompt: vi.fn((prompt: string) => prompt),
  sanitizePromptForImageGeneration: vi.fn((prompt: string) => Promise.resolve(prompt)),
}));

vi.mock('@/utils/image-storage', () => ({
  persistImage: vi.fn((url: string) => Promise.resolve(url)),
}));

import handler from '@/pages/api/generate-image';
import { requireAuth, checkRateLimit } from '@/utils/api-auth';
import { generateImage } from '@/utils/openai';

describe('Journey: generate_scene_image - Generate AI Image for Scene', () => {
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

  it('should reject image generation for unauthenticated user', async () => {
    vi.mocked(requireAuth).mockImplementation(async (_req, res) => {
      (res as unknown as typeof mockRes).status(401).json({ error: 'Unauthorized' });
      return null;
    });

    mockReq.body = {
      projectId: 'project-123',
      sceneId: 'scene-456',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(401);
  });

  it('should reject requests without required parameters', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');
    vi.mocked(checkRateLimit).mockReturnValue(true);

    mockReq.body = {};

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(400);
  });

  it('should reject non-POST requests', async () => {
    mockReq.method = 'GET';

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(405);
    expect(mockRes.headers['Allow']).toContain('POST');
  });

  it('should successfully generate an image with valid prompt', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(generateImage).mockResolvedValue({
      success: true,
      imageUrl: 'https://example.com/generated-image.png',
    });

    mockReq.body = {
      prompt: 'A dramatic sunset over mountains',
      size: '1024x1024',
      projectId: 'project-123',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(200);
    const data = mockRes.data as { success: boolean; imageUrl: string };
    expect(data.success).toBe(true);
    expect(data.imageUrl).toBe('https://example.com/generated-image.png');
  });

  it('should respect rate limiting', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');
    vi.mocked(checkRateLimit).mockReturnValue(false);

    mockReq.body = {
      projectId: 'project-123',
      sceneId: 'scene-456',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(429);
    const data = mockRes.data as { error: string };
    expect(data.error.toLowerCase()).toContain('rate');
  });
});

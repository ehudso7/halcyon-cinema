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
  persistImage: vi.fn((_url: string, projectId: string, sceneId?: string) => {
    // Simulate actual behavior: return a different URL representing Supabase storage
    const filename = sceneId
      ? `${projectId}/${sceneId}/image-123.png`
      : `${projectId}/image-123.png`;
    return Promise.resolve(`https://test.supabase.co/storage/v1/object/public/scene-images/${filename}`);
  }),
  isPersistedUrl: vi.fn((url: string) => url.includes('supabase.co/storage')),
  resetBucketCache: vi.fn(),
}));

import handler from '@/pages/api/generate-image';
import { requireAuth, checkRateLimit } from '@/utils/api-auth';
import { generateImage } from '@/utils/openai';
import { persistImage, isPersistedUrl } from '@/utils/image-storage';

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
    const data = mockRes.data as { success: boolean; imageUrl: string; urlType?: string };
    expect(data.success).toBe(true);

    // Verify persistImage was called with correct arguments
    expect(vi.mocked(persistImage)).toHaveBeenCalledWith(
      'https://example.com/generated-image.png',
      'project-123',
      undefined
    );

    // Verify the returned URL is the persisted Supabase URL, not the original
    expect(data.imageUrl).toContain('supabase.co/storage');
    expect(data.imageUrl).toContain('project-123');

    // Verify urlType is 'permanent' for persisted URLs
    expect(data.urlType).toBe('permanent');
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

  it('should return temporary urlType when storage is not configured', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(generateImage).mockResolvedValue({
      success: true,
      imageUrl: 'https://openai.com/temp-image.png',
    });
    // Simulate storage not configured: persistImage returns original URL
    vi.mocked(persistImage).mockResolvedValue('https://openai.com/temp-image.png');
    // isPersistedUrl returns false for non-Supabase URLs
    vi.mocked(isPersistedUrl).mockReturnValue(false);

    mockReq.body = {
      prompt: 'A test image',
      projectId: 'project-123',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(200);
    const data = mockRes.data as { success: boolean; imageUrl: string; urlType?: string; warning?: string };
    expect(data.success).toBe(true);
    expect(data.urlType).toBe('temporary');
    expect(data.warning).toContain('temporary');
  });

  it('should return temporary urlType when persistence fails', async () => {
    vi.mocked(requireAuth).mockResolvedValue('user-123');
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(generateImage).mockResolvedValue({
      success: true,
      imageUrl: 'https://openai.com/temp-image.png',
    });
    // Simulate persistence failure
    vi.mocked(persistImage).mockRejectedValue(new Error('Storage connection failed'));

    mockReq.body = {
      prompt: 'A test image',
      projectId: 'project-123',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(200);
    const data = mockRes.data as { success: boolean; imageUrl: string; urlType?: string; warning?: string };
    expect(data.success).toBe(true);
    expect(data.imageUrl).toBe('https://openai.com/temp-image.png');
    expect(data.urlType).toBe('temporary');
    expect(data.warning).toContain('persistence failed');
  });
});

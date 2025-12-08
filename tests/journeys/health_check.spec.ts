/**
 * Journey: health_check - Health Check Endpoint
 * Tags: [api, monitoring]
 *
 * Tests that the health check endpoint returns proper status information
 * including database connectivity, uptime, and version.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mock the db module
vi.mock('@/utils/db', () => ({
  isPostgresAvailable: vi.fn(),
}));

// Mock @vercel/postgres
vi.mock('@vercel/postgres', () => ({
  sql: vi.fn(),
}));

import handler from '@/pages/api/health';
import { isPostgresAvailable } from '@/utils/db';
import { sql } from '@vercel/postgres';

describe('Journey: health_check - Health Check Endpoint', () => {
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

  it('should return 200 and healthy status when Postgres is available and connected', async () => {
    // Step: Send GET request to /api/health
    vi.mocked(isPostgresAvailable).mockReturnValue(true);
    vi.mocked(sql).mockResolvedValue({ rows: [{ '?column?': 1 }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] });

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    // Expected: Response status is 200 (healthy)
    expect(mockRes.statusCode).toBe(200);

    // Expected: Response includes status, timestamp, version
    const data = mockRes.data as Record<string, unknown>;
    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
    expect(typeof data.timestamp).toBe('string');
    expect(data.version).toBeDefined();

    // Expected: Database connectivity status is reported
    const checks = data.checks as Record<string, unknown>;
    expect(checks.database).toBeDefined();
    const dbCheck = checks.database as Record<string, unknown>;
    expect(dbCheck.status).toBe('up');
    expect(dbCheck.type).toBe('postgres');

    // Expected: If Postgres configured, latency is reported
    expect(dbCheck.latencyMs).toBeDefined();
    expect(typeof dbCheck.latencyMs).toBe('number');

    // Expected: Uptime is reported
    expect(data.uptime).toBeDefined();
    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should return healthy status when Postgres is not configured (development)', async () => {
    vi.mocked(isPostgresAvailable).mockReturnValue(false);
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    // In development without Postgres, should still be healthy
    expect(mockRes.statusCode).toBe(200);
    const data = mockRes.data as Record<string, unknown>;
    expect(data.status).toBe('healthy');

    const checks = data.checks as Record<string, unknown>;
    const dbCheck = checks.database as Record<string, unknown>;
    expect(dbCheck.status).toBe('not_configured');
    expect(dbCheck.type).toBe('file');

    process.env.NODE_ENV = originalEnv;
  });

  it('should return degraded status when Postgres is not configured in production', async () => {
    vi.mocked(isPostgresAvailable).mockReturnValue(false);
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    // In production without Postgres, should be degraded but still 200
    expect(mockRes.statusCode).toBe(200);
    const data = mockRes.data as Record<string, unknown>;
    expect(data.status).toBe('degraded');

    process.env.NODE_ENV = originalEnv;
  });

  it('should return unhealthy status (503) when database connection fails', async () => {
    vi.mocked(isPostgresAvailable).mockReturnValue(true);
    vi.mocked(sql).mockRejectedValue(new Error('Connection refused'));

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    // Expected: Status is unhealthy with 503
    expect(mockRes.statusCode).toBe(503);
    const data = mockRes.data as Record<string, unknown>;
    expect(data.status).toBe('unhealthy');

    const checks = data.checks as Record<string, unknown>;
    const dbCheck = checks.database as Record<string, unknown>;
    expect(dbCheck.status).toBe('down');
  });

  it('should reject non-GET requests with 405', async () => {
    mockReq.method = 'POST';

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(405);
    expect(mockRes.headers['Allow']).toContain('GET');
  });

  it('should set no-cache headers', async () => {
    vi.mocked(isPostgresAvailable).mockReturnValue(false);

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.headers['Cache-Control']).toBe('no-store, max-age=0');
  });
});

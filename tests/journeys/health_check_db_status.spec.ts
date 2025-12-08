/**
 * Journey: health_check_db_status - Health Check Reports Database Status
 * Tags: [api, monitoring, database]
 *
 * Tests that the health check accurately reports database connectivity status
 * with proper status values and latency information.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mock the db module
vi.mock('@/utils/db', () => ({
  isPostgresAvailable: vi.fn(),
  testConnection: vi.fn(),
}));

import handler from '@/pages/api/health';
import { isPostgresAvailable, testConnection } from '@/utils/db';

describe('Journey: health_check_db_status - Health Check Reports Database Status', () => {
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

  it('should report database status as "up" when Postgres is available and responds', async () => {
    vi.mocked(isPostgresAvailable).mockReturnValue(true);
    vi.mocked(testConnection).mockResolvedValue(undefined);

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    const data = mockRes.data as Record<string, unknown>;
    const checks = data.checks as Record<string, unknown>;
    const dbCheck = checks.database as Record<string, unknown>;

    // Expected: Database check status is 'up'
    expect(dbCheck.status).toBe('up');
    expect(dbCheck.type).toBe('postgres');

    // Expected: Latency is reported when DB is up
    expect(dbCheck.latencyMs).toBeDefined();
    expect(typeof dbCheck.latencyMs).toBe('number');
    expect(dbCheck.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('should report database status as "down" when Postgres query fails', async () => {
    vi.mocked(isPostgresAvailable).mockReturnValue(true);
    vi.mocked(testConnection).mockRejectedValue(new Error('ECONNREFUSED'));

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    const data = mockRes.data as Record<string, unknown>;
    const checks = data.checks as Record<string, unknown>;
    const dbCheck = checks.database as Record<string, unknown>;

    // Expected: Database check status is 'down'
    expect(dbCheck.status).toBe('down');
    // Expected: Overall status reflects database health
    expect(data.status).toBe('unhealthy');
  });

  it('should report database status as "not_configured" when Postgres is not available', async () => {
    vi.mocked(isPostgresAvailable).mockReturnValue(false);

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    const data = mockRes.data as Record<string, unknown>;
    const checks = data.checks as Record<string, unknown>;
    const dbCheck = checks.database as Record<string, unknown>;

    // Expected: Database check status is 'not_configured'
    expect(dbCheck.status).toBe('not_configured');
    expect(dbCheck.type).toBe('file');

    // Latency should not be present when DB is not configured
    expect(dbCheck.latencyMs).toBeUndefined();
  });

  it('should not include latency when database is down', async () => {
    vi.mocked(isPostgresAvailable).mockReturnValue(true);
    vi.mocked(testConnection).mockRejectedValue(new Error('Connection timeout'));

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    const data = mockRes.data as Record<string, unknown>;
    const checks = data.checks as Record<string, unknown>;
    const dbCheck = checks.database as Record<string, unknown>;

    // Latency should not be present when DB query fails
    expect(dbCheck.latencyMs).toBeUndefined();
  });
});

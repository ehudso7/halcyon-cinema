import { vi } from 'vitest';

// Mock environment variables for testing
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Mock @vercel/postgres for tests that don't need real DB
vi.mock('@vercel/postgres', () => ({
  sql: vi.fn(),
}));

// Global test utilities
export const createMockRequest = (options: {
  method?: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}) => {
  return {
    method: options.method || 'GET',
    body: options.body || {},
    query: options.query || {},
    headers: options.headers || {},
  };
};

export const createMockResponse = () => {
  const res: {
    statusCode: number;
    data: unknown;
    headers: Record<string, string>;
    status: (code: number) => typeof res;
    json: (data: unknown) => typeof res;
    setHeader: (key: string, value: string) => typeof res;
    end: () => typeof res;
  } = {
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
  return res;
};

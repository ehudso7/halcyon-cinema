/**
 * Journey: signup_email - User Registration with Email
 * Tags: [auth, critical]
 *
 * Tests the user registration flow via the /api/auth/register endpoint.
 * Verifies that users can create accounts, passwords are properly hashed,
 * and appropriate errors are returned for invalid inputs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mock the users module
vi.mock('@/utils/users', () => ({
  createUser: vi.fn(),
}));

import handler from '@/pages/api/auth/register';
import { createUser } from '@/utils/users';

describe('Journey: signup_email - User Registration with Email', () => {
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

  it('should successfully register a new user with valid credentials', async () => {
    // Precondition: Email is not already registered
    const mockUser = {
      id: 'test-uuid-123',
      email: 'newuser@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(createUser).mockResolvedValue(mockUser);

    // Steps: Enter valid email, password (min 8 chars), display name, submit
    mockReq.body = {
      email: 'newuser@example.com',
      password: 'securePassword123',
      name: 'Test User',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    // Expected: User account is created in database (201 status)
    expect(mockRes.statusCode).toBe(201);

    // Expected: User data is returned (without passwordHash)
    const data = mockRes.data as { user: typeof mockUser };
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe('test-uuid-123');
    expect(data.user.email).toBe('newuser@example.com');
    expect(data.user.name).toBe('Test User');

    // Verify createUser was called with correct params
    expect(createUser).toHaveBeenCalledWith(
      'newuser@example.com',
      'securePassword123',
      'Test User'
    );
  });

  it('should reject registration with missing email', async () => {
    mockReq.body = {
      password: 'securePassword123',
      name: 'Test User',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(400);
    const data = mockRes.data as { error: string };
    expect(data.error).toBe('Email is required');
  });

  it('should reject registration with invalid email format', async () => {
    mockReq.body = {
      email: 'invalid-email',
      password: 'securePassword123',
      name: 'Test User',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(400);
    const data = mockRes.data as { error: string };
    expect(data.error).toBe('Invalid email format');
  });

  it('should reject registration with password shorter than 8 characters', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'short',
      name: 'Test User',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(400);
    const data = mockRes.data as { error: string };
    expect(data.error).toBe('Password must be at least 8 characters');
  });

  it('should reject registration with missing name', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'securePassword123',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(400);
    const data = mockRes.data as { error: string };
    expect(data.error).toBe('Name is required');
  });

  it('should return 409 when email already exists', async () => {
    // Precondition: Email is already registered
    vi.mocked(createUser).mockRejectedValue(new Error('User already exists'));

    mockReq.body = {
      email: 'existing@example.com',
      password: 'securePassword123',
      name: 'Test User',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(409);
    const data = mockRes.data as { error: string };
    expect(data.error).toBe('An account with this email already exists');
  });

  it('should return 503 for database connection errors', async () => {
    vi.mocked(createUser).mockRejectedValue(new Error('Database connection failed'));

    mockReq.body = {
      email: 'user@example.com',
      password: 'securePassword123',
      name: 'Test User',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(503);
    const data = mockRes.data as { error: string; code?: string };
    expect(data.error).toBe('Database service unavailable. Please try again later or contact support.');
    expect(data.code).toBe('DB_UNAVAILABLE');
  });

  it('should return 500 for unexpected errors', async () => {
    vi.mocked(createUser).mockRejectedValue(new Error('Unexpected internal error'));

    mockReq.body = {
      email: 'user@example.com',
      password: 'securePassword123',
      name: 'Test User',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(500);
    const data = mockRes.data as { error: string };
    expect(data.error).toBe('Failed to create account');
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

  it('should detect database role errors via regex pattern', async () => {
    vi.mocked(createUser).mockRejectedValue(new Error('role "myuser" does not exist'));

    mockReq.body = {
      email: 'user@example.com',
      password: 'securePassword123',
      name: 'Test User',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(503);
    const data = mockRes.data as { error: string; code?: string };
    expect(data.code).toBe('DB_UNAVAILABLE');
    expect(data.error).toBe('Database service unavailable. Please try again later or contact support.');
  });

  it('should detect database name errors via regex pattern', async () => {
    vi.mocked(createUser).mockRejectedValue(new Error('database "mydb" does not exist'));

    mockReq.body = {
      email: 'user@example.com',
      password: 'securePassword123',
      name: 'Test User',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(503);
    const data = mockRes.data as { error: string; code?: string };
    expect(data.code).toBe('DB_UNAVAILABLE');
  });

  it('should detect ECONNREFUSED errors', async () => {
    vi.mocked(createUser).mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

    mockReq.body = {
      email: 'user@example.com',
      password: 'securePassword123',
      name: 'Test User',
    };

    await handler(
      mockReq as NextApiRequest,
      mockRes as unknown as NextApiResponse
    );

    expect(mockRes.statusCode).toBe(503);
    const data = mockRes.data as { error: string; code?: string };
    expect(data.code).toBe('DB_UNAVAILABLE');
  });
});

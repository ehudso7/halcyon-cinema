/**
 * Journey: login_invalid_credentials - Login with Invalid Credentials
 * Tags: [auth, critical, negative]
 *
 * Tests that authentication fails appropriately when invalid credentials
 * are provided, ensuring proper error handling and security.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

// Mock the users module
vi.mock('@/utils/users', () => ({
  validateUser: vi.fn(),
}));

import { validateUser } from '@/utils/users';

describe('Journey: login_invalid_credentials - Login with Invalid Credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const authorize = authOptions.providers[0].options?.authorize;

  it('should reject login with incorrect password', async () => {
    // Precondition: User exists but wrong password is provided
    vi.mocked(validateUser).mockResolvedValue(null);

    const credentials = {
      email: 'user@example.com',
      password: 'wrongPassword123',
    };

    const result = await authorize?.(credentials, {} as never);

    // Expected: Authentication fails
    expect(result).toBeNull();

    // Expected: validateUser was still called (to verify credentials)
    expect(validateUser).toHaveBeenCalledWith(
      'user@example.com',
      'wrongPassword123'
    );
  });

  it('should reject login for non-existent user', async () => {
    // Precondition: Email does not exist in database
    vi.mocked(validateUser).mockResolvedValue(null);

    const credentials = {
      email: 'nonexistent@example.com',
      password: 'anyPassword123',
    };

    const result = await authorize?.(credentials, {} as never);

    // Expected: Authentication fails
    expect(result).toBeNull();

    // Expected: User remains on signin page (no session created)
    // Note: In actual implementation, NextAuth handles this by not creating session
  });

  it('should reject login with empty email', async () => {
    const credentials = {
      email: '',
      password: 'somePassword123',
    };

    const result = await authorize?.(credentials, {} as never);

    // Expected: Authentication fails immediately
    expect(result).toBeNull();

    // Expected: No database call made for empty credentials
    expect(validateUser).not.toHaveBeenCalled();
  });

  it('should reject login with empty password', async () => {
    const credentials = {
      email: 'user@example.com',
      password: '',
    };

    const result = await authorize?.(credentials, {} as never);

    // Expected: Authentication fails immediately
    expect(result).toBeNull();

    // Expected: No database call made for empty credentials
    expect(validateUser).not.toHaveBeenCalled();
  });

  it('should reject login with null credentials', async () => {
    const result = await authorize?.(null as never, {} as never);

    expect(result).toBeNull();
    expect(validateUser).not.toHaveBeenCalled();
  });

  it('should reject login when validateUser throws an error', async () => {
    // Simulate database error
    vi.mocked(validateUser).mockRejectedValue(new Error('Database connection failed'));

    const credentials = {
      email: 'user@example.com',
      password: 'password123',
    };

    // Expected: Error should propagate, preventing session creation
    await expect(authorize?.(credentials, {} as never)).rejects.toThrow();
  });

  it('should not expose whether email exists (timing-safe)', async () => {
    // Both valid and invalid users should go through validateUser
    // to prevent email enumeration attacks

    // Test 1: Valid email, wrong password
    vi.mocked(validateUser).mockResolvedValue(null);
    const result1 = await authorize?.(
      { email: 'valid@example.com', password: 'wrong' },
      {} as never
    );

    // Test 2: Invalid email
    vi.mocked(validateUser).mockResolvedValue(null);
    const result2 = await authorize?.(
      { email: 'invalid@example.com', password: 'any' },
      {} as never
    );

    // Both should return null (no distinction in response)
    expect(result1).toBeNull();
    expect(result2).toBeNull();

    // Both should call validateUser (same code path)
    expect(validateUser).toHaveBeenCalledTimes(2);
  });
});

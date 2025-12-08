/**
 * Journey: login_email - User Login with Email/Password
 * Tags: [auth, critical]
 *
 * Tests the user login flow via NextAuth credentials provider.
 * Verifies that users can authenticate with valid credentials
 * and proper session handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

// Mock the users module
vi.mock('@/utils/users', () => ({
  validateUser: vi.fn(),
}));

import { validateUser } from '@/utils/users';

describe('Journey: login_email - User Login with Email/Password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authorize function', () => {
    const authorize = authOptions.providers[0].options?.authorize;

    it('should successfully authenticate user with valid credentials', async () => {
      // Precondition: User account exists with known email/password
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        image: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(validateUser).mockResolvedValue(mockUser);

      // Steps: Enter registered email and correct password
      const credentials = {
        email: 'user@example.com',
        password: 'correctPassword123',
      };

      const result = await authorize?.(credentials, {} as never);

      // Expected: User is authenticated
      expect(result).toBeDefined();
      expect(result).not.toBeNull();

      // Expected: Session user data is returned
      expect(result?.id).toBe('user-123');
      expect(result?.email).toBe('user@example.com');
      expect(result?.name).toBe('Test User');

      // Verify validateUser was called with correct params
      expect(validateUser).toHaveBeenCalledWith(
        'user@example.com',
        'correctPassword123'
      );
    });

    it('should reject login when validateUser returns null (invalid credentials)', async () => {
      // Precondition: Password is incorrect
      vi.mocked(validateUser).mockResolvedValue(null);

      const credentials = {
        email: 'user@example.com',
        password: 'wrongPassword',
      };

      const result = await authorize?.(credentials, {} as never);

      // Expected: Authentication fails
      expect(result).toBeNull();

      expect(validateUser).toHaveBeenCalledWith(
        'user@example.com',
        'wrongPassword'
      );
    });

    it('should reject login with missing email', async () => {
      const credentials = {
        email: '',
        password: 'somePassword',
      };

      const result = await authorize?.(credentials, {} as never);

      // Expected: No session is created
      expect(result).toBeNull();

      // validateUser should not be called
      expect(validateUser).not.toHaveBeenCalled();
    });

    it('should reject login with missing password', async () => {
      const credentials = {
        email: 'user@example.com',
        password: '',
      };

      const result = await authorize?.(credentials, {} as never);

      expect(result).toBeNull();
      expect(validateUser).not.toHaveBeenCalled();
    });

    it('should reject login with undefined credentials', async () => {
      const result = await authorize?.(undefined as never, {} as never);

      expect(result).toBeNull();
      expect(validateUser).not.toHaveBeenCalled();
    });
  });

  describe('session configuration', () => {
    it('should use JWT strategy', () => {
      expect(authOptions.session?.strategy).toBe('jwt');
    });

    it('should have 30-day session expiry', () => {
      expect(authOptions.session?.maxAge).toBe(30 * 24 * 60 * 60);
    });
  });

  describe('callbacks', () => {
    it('should add user id to JWT token', async () => {
      const jwtCallback = authOptions.callbacks?.jwt;
      const mockUser = { id: 'user-123', email: 'test@example.com', name: 'Test' };
      const mockToken = {};

      const result = await jwtCallback?.({
        token: mockToken,
        user: mockUser,
        account: null,
        trigger: 'signIn',
      });

      // Expected: Token includes user id
      expect(result?.id).toBe('user-123');
    });

    it('should add user id to session', async () => {
      const sessionCallback = authOptions.callbacks?.session;
      const mockSession = {
        user: { id: '', email: 'test@example.com', name: 'Test' },
        expires: new Date().toISOString(),
      };
      const mockToken = { id: 'user-123' };

      const result = await sessionCallback?.({
        session: mockSession,
        token: mockToken,
        user: {} as never,
        newSession: undefined,
        trigger: 'update',
      });

      // Expected: Session includes user id
      expect(result?.user?.id).toBe('user-123');
    });
  });

  describe('pages configuration', () => {
    it('should redirect to custom signin page', () => {
      expect(authOptions.pages?.signIn).toBe('/auth/signin');
    });

    it('should redirect to custom error page', () => {
      expect(authOptions.pages?.error).toBe('/auth/error');
    });
  });
});

/**
 * E2E Journey Tests: Authentication Flows
 *
 * These tests verify the complete signup and login flows work end-to-end
 * by making actual HTTP requests to the running dev server.
 *
 * Prerequisites:
 * - Dev server running on localhost:3000
 * - .env.local with NEXTAUTH_SECRET set
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Generate unique test emails to avoid conflicts
const TEST_EMAIL = `e2e-test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'SecurePassword123!';
const TEST_NAME = 'E2E Test User';

describe('E2E Journey: signup_email - User Registration with Email', () => {
  it('should successfully create a new account', async () => {
    // Step 1: POST to /api/auth/register with valid credentials
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME,
      }),
    });

    // Expected: 201 Created with user data
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(TEST_EMAIL.toLowerCase());
    expect(data.user.name).toBe(TEST_NAME);
    expect(data.user.id).toBeDefined();

    // Security: Password should NOT be returned
    expect(data.user.passwordHash).toBeUndefined();
    expect(data.user.password).toBeUndefined();
  });

  it('should reject duplicate email registration', async () => {
    // Step 1: Try to register with the same email again
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: 'Another User',
      }),
    });

    // Expected: 409 Conflict
    expect(response.status).toBe(409);

    const data = await response.json();
    expect(data.error).toContain('already exists');
  });

  it('should reject invalid email format', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: TEST_PASSWORD,
        name: TEST_NAME,
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.toLowerCase()).toContain('email');
  });

  it('should reject password shorter than 8 characters', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newuser@example.com',
        password: 'short',
        name: TEST_NAME,
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.toLowerCase()).toContain('password');
  });

  it('should reject missing required fields', async () => {
    // Missing name
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: TEST_PASSWORD,
      }),
    });

    expect(response.status).toBe(400);
  });
});

describe('E2E Journey: login_email - User Login with Email', () => {
  // Use the user created in the signup tests
  const LOGIN_EMAIL = TEST_EMAIL;
  const LOGIN_PASSWORD = TEST_PASSWORD;

  it('should successfully authenticate with valid credentials', async () => {
    // Step 1: Get CSRF token
    const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
    expect(csrfResponse.ok).toBe(true);

    const csrfData = await csrfResponse.json();
    expect(csrfData.csrfToken).toBeDefined();

    // Step 2: Get cookies from CSRF request
    const cookies = csrfResponse.headers.get('set-cookie') || '';

    // Step 3: Attempt login
    const loginResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
      },
      body: new URLSearchParams({
        csrfToken: csrfData.csrfToken,
        email: LOGIN_EMAIL,
        password: LOGIN_PASSWORD,
      }).toString(),
      redirect: 'manual', // Don't follow redirects
    });

    // Expected: 302 redirect (successful auth redirects)
    expect(loginResponse.status).toBe(302);

    // Should have session cookies set
    const sessionCookie = loginResponse.headers.get('set-cookie');
    expect(sessionCookie).toBeTruthy();
  });

  it('should reject invalid password', async () => {
    const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
    const csrfData = await csrfResponse.json();
    const cookies = csrfResponse.headers.get('set-cookie') || '';

    const loginResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
      },
      body: new URLSearchParams({
        csrfToken: csrfData.csrfToken,
        email: LOGIN_EMAIL,
        password: 'wrong-password',
      }).toString(),
      redirect: 'manual',
    });

    // NextAuth returns 302 redirect to error page on failed auth
    expect(loginResponse.status).toBe(302);

    // Check it redirects to error page
    const location = loginResponse.headers.get('location');
    expect(location).toContain('error');
  });

  it('should reject non-existent email', async () => {
    const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
    const csrfData = await csrfResponse.json();
    const cookies = csrfResponse.headers.get('set-cookie') || '';

    const loginResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
      },
      body: new URLSearchParams({
        csrfToken: csrfData.csrfToken,
        email: 'nonexistent@example.com',
        password: 'any-password',
      }).toString(),
      redirect: 'manual',
    });

    // Should redirect to error
    expect(loginResponse.status).toBe(302);
    const location = loginResponse.headers.get('location');
    expect(location).toContain('error');
  });
});

describe('E2E Journey: Session verification', () => {
  it('should return empty session for unauthenticated requests', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/session`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    // Empty object means no session
    expect(Object.keys(data).length).toBe(0);
  });

  it('health endpoint should work without authentication', async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.status).toBeDefined();
    expect(['healthy', 'degraded']).toContain(data.status);
  });
});

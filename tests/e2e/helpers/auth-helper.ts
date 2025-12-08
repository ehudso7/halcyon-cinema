/**
 * E2E Test Authentication Helper
 *
 * Provides utilities to register/login and get session cookies
 * for authenticated API requests during E2E testing.
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

export interface AuthSession {
  cookies: string;
  userId: string;
  email: string;
}

/**
 * Register a new user and return session info
 */
export async function registerUser(
  email: string,
  password: string,
  name: string
): Promise<{ userId: string; email: string }> {
  const response = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Registration failed: ${error.error || response.status}`);
  }

  const data = await response.json();
  return { userId: data.user.id, email: data.user.email };
}

/**
 * Login and return session cookies
 */
export async function loginUser(
  email: string,
  password: string
): Promise<string> {
  // Step 1: Get CSRF token
  const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error('Failed to get CSRF token');
  }

  const csrfData = await csrfResponse.json();
  const csrfCookies = csrfResponse.headers.get('set-cookie') || '';

  // Step 2: Login with credentials
  const loginResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': csrfCookies,
    },
    body: new URLSearchParams({
      csrfToken: csrfData.csrfToken,
      email,
      password,
    }).toString(),
    redirect: 'manual',
  });

  if (loginResponse.status !== 302) {
    throw new Error(`Login failed with status ${loginResponse.status}`);
  }

  // Extract all cookies from the login response
  const sessionCookies = loginResponse.headers.get('set-cookie') || '';

  // Combine CSRF and session cookies
  return combineCookies(csrfCookies, sessionCookies);
}

/**
 * Register and login a new user, returning full session
 */
export async function createAuthenticatedSession(
  emailPrefix: string = 'e2e-test'
): Promise<AuthSession> {
  // Use timestamp + random string to prevent race conditions in parallel tests
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const email = `${emailPrefix}-${uniqueId}@example.com`;
  const password = 'SecurePassword123!';
  const name = 'E2E Test User';

  const { userId } = await registerUser(email, password, name);
  const cookies = await loginUser(email, password);

  return { cookies, userId, email };
}

/**
 * Make an authenticated GET request
 */
export async function authGet(
  path: string,
  cookies: string
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { 'Cookie': cookies },
  });
}

/**
 * Make an authenticated POST request
 */
export async function authPost(
  path: string,
  cookies: string,
  body: object
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Make an authenticated PUT request
 */
export async function authPut(
  path: string,
  cookies: string,
  body: object
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Make an authenticated DELETE request
 */
export async function authDelete(
  path: string,
  cookies: string
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: { 'Cookie': cookies },
  });
}

/**
 * Combine multiple Set-Cookie headers into a Cookie header value
 */
function combineCookies(...cookieHeaders: string[]): string {
  const cookies: string[] = [];

  for (const header of cookieHeaders) {
    if (!header) continue;

    // Split by comma but handle expires which contains comma
    const parts = header.split(/,(?=[^;]*=)/);

    for (const part of parts) {
      // Extract just the cookie name=value (before first ;)
      const match = part.trim().match(/^([^=]+=[^;]*)/);
      if (match) {
        cookies.push(match[1]);
      }
    }
  }

  return cookies.join('; ');
}

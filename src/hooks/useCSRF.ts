import { useState, useEffect, useCallback } from 'react';

const CSRF_HEADER_NAME = 'x-csrf-token';

interface UseCSRFReturn {
  /** The current CSRF token */
  token: string | null;
  /** Whether the token is being fetched */
  loading: boolean;
  /** Any error that occurred */
  error: Error | null;
  /** Fetch a new CSRF token */
  refresh: () => Promise<void>;
  /** Get headers object with CSRF token included */
  getHeaders: (additionalHeaders?: Record<string, string>) => Record<string, string>;
  /** Make a fetch request with CSRF token automatically included */
  csrfFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

/**
 * Hook to manage CSRF tokens for secure API requests
 * Automatically fetches a token on mount and provides helpers for including it in requests
 */
export function useCSRF(): UseCSRFReturn {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }

      const data = await response.json();
      setToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      console.error('[useCSRF] Failed to fetch token:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  const getHeaders = useCallback(
    (additionalHeaders?: Record<string, string>): Record<string, string> => {
      const headers: Record<string, string> = {
        ...additionalHeaders,
      };

      if (token) {
        headers[CSRF_HEADER_NAME] = token;
      }

      return headers;
    },
    [token]
  );

  const csrfFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(options.headers);

      if (token) {
        headers.set(CSRF_HEADER_NAME, token);
      }

      return fetch(url, {
        ...options,
        headers,
        credentials: options.credentials || 'include',
      });
    },
    [token]
  );

  return {
    token,
    loading,
    error,
    refresh: fetchToken,
    getHeaders,
    csrfFetch,
  };
}

/**
 * Create a fetch wrapper with CSRF token included
 * Use this for one-off requests where you don't need the full hook
 */
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // First, get a CSRF token if we don't have one
  let csrfToken: string | null = null;

  try {
    const tokenResponse = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
    });

    if (tokenResponse.ok) {
      const data = await tokenResponse.json();
      csrfToken = data.token;
    }
  } catch (err) {
    console.warn('[fetchWithCSRF] Failed to get CSRF token:', err);
  }

  const headers = new Headers(options.headers);

  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: options.credentials || 'include',
  });
}

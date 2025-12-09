import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Client Utilities
 *
 * This module provides Supabase client instances for different use cases:
 * - Browser client: Uses anon key, safe for client-side
 * - Server client: Uses service role key, for admin operations
 *
 * Environment variables used:
 * - NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL: Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Anonymous/public key for client-side
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for server-side admin ops
 * - SUPABASE_JWT_SECRET: For verifying Supabase JWTs (if needed)
 */

// Cached client instances
let browserClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

/**
 * Get the Supabase URL from environment variables.
 * Prefers NEXT_PUBLIC_SUPABASE_URL for consistency, falls back to SUPABASE_URL.
 */
export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

/**
 * Get the Supabase anon key from environment variables.
 */
export function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/**
 * Get the Supabase service role key from environment variables.
 * This key has admin privileges - only use server-side!
 */
export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Get the Supabase JWT secret for verifying tokens.
 */
export function getSupabaseJwtSecret(): string | undefined {
  return process.env.SUPABASE_JWT_SECRET;
}

/**
 * Check if Supabase client configuration is available.
 */
export function isSupabaseConfigured(): boolean {
  return !!(getSupabaseUrl() && getSupabaseAnonKey());
}

/**
 * Check if Supabase admin/service role is configured.
 */
export function isSupabaseAdminConfigured(): boolean {
  return !!(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

/**
 * Get or create the browser-safe Supabase client.
 * Uses the anonymous key - safe for client-side usage.
 *
 * Use this for:
 * - Client-side data fetching
 * - Real-time subscriptions
 * - User-scoped operations
 *
 * @throws Error if Supabase is not configured
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error(
      'Supabase client not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return browserClient;
}

/**
 * Get or create the server-side Supabase client with admin privileges.
 * Uses the service role key - NEVER expose this client-side!
 *
 * Use this for:
 * - Server-side admin operations
 * - Bypassing Row Level Security
 * - Background jobs
 *
 * @throws Error if Supabase admin is not configured
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (serverClient) {
    return serverClient;
  }

  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase admin client not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  serverClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serverClient;
}

/**
 * Create a one-off Supabase client (not cached).
 * Useful for isolated operations or testing.
 */
export function createSupabaseClient(
  url: string,
  key: string,
  options?: { admin?: boolean }
): SupabaseClient {
  return createClient(url, key, {
    auth: {
      persistSession: !options?.admin,
      autoRefreshToken: !options?.admin,
    },
  });
}

/**
 * Get the Supabase JWT secret for use in token verification.
 * Requires SUPABASE_JWT_SECRET to be configured.
 *
 * Note: This only returns the secret. For actual JWT verification,
 * use Supabase's built-in auth verification or a proper JWT library.
 *
 * @throws Error if SUPABASE_JWT_SECRET is not configured
 */
export function getJwtSecret(): string {
  const secret = getSupabaseJwtSecret();
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET is not configured');
  }
  return secret;
}

// Export type for external use
export type { SupabaseClient };

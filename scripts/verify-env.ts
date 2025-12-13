#!/usr/bin/env npx ts-node
/**
 * Environment Variable Verification Script
 *
 * Verifies that required environment variables are set and external services
 * are reachable without making actual generation requests.
 *
 * Usage: npx ts-node scripts/verify-env.ts
 *
 * Note: This script reads environment variables from process.env.
 * For local development, create a .env.local file in the project root.
 */

// Try to load dotenv if available (optional)
try {
  require('dotenv').config({ path: '.env.local' });
} catch {
  // dotenv not installed, continue with existing env vars
}

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

const results: CheckResult[] = [];

function check(name: string, condition: boolean, passMsg: string, failMsg: string, isWarning = false): void {
  results.push({
    name,
    status: condition ? 'pass' : isWarning ? 'warning' : 'fail',
    message: condition ? passMsg : failMsg,
  });
}

async function verifyOpenAI(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    check('OPENAI_API_KEY', false, '', 'Not set - image and voiceover generation will not work');
    return;
  }

  // Validate format (starts with sk-)
  if (!apiKey.startsWith('sk-')) {
    check('OPENAI_API_KEY', false, '', 'Invalid format - should start with "sk-"');
    return;
  }

  // Test connectivity by listing models (lightweight API call)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      check('OPENAI_API_KEY', true, 'Valid and connected', '');
    } else if (response.status === 401) {
      check('OPENAI_API_KEY', false, '', 'Invalid API key (401 Unauthorized)');
    } else {
      check('OPENAI_API_KEY', false, '', `API returned status ${response.status}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    check('OPENAI_API_KEY', false, '', `Connection failed: ${msg}`);
  }
}

async function verifyReplicate(): Promise<void> {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    check('REPLICATE_API_TOKEN', false, '', 'Not set - video and music generation will not work');
    return;
  }

  // Test connectivity by getting account info (lightweight API call)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://api.replicate.com/v1/account', {
      headers: {
        'Authorization': `Token ${apiToken}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json() as { username?: string };
      check('REPLICATE_API_TOKEN', true, `Valid and connected (account: ${data.username || 'unknown'})`, '');
    } else if (response.status === 401) {
      check('REPLICATE_API_TOKEN', false, '', 'Invalid API token (401 Unauthorized)');
    } else {
      check('REPLICATE_API_TOKEN', false, '', `API returned status ${response.status}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    check('REPLICATE_API_TOKEN', false, '', `Connection failed: ${msg}`);
  }
}

function verifyDatabase(): void {
  const postgresUrl = process.env.POSTGRES_URL;
  const databaseUrl = process.env.DATABASE_URL;
  const hasComponents = !!(
    process.env.POSTGRES_HOST &&
    process.env.POSTGRES_USER &&
    process.env.POSTGRES_PASSWORD &&
    process.env.POSTGRES_DATABASE
  );

  if (postgresUrl || databaseUrl || hasComponents) {
    check('Database', true, 'Configuration found', '');
  } else {
    check('Database', false, '', 'No database configuration found - will use file-based storage', true);
  }
}

function verifySupabase(): void {
  const hasClientConfig = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const hasServerConfig = !!(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (hasClientConfig && hasServerConfig) {
    check('Supabase', true, 'Fully configured (client + server)', '');
  } else if (hasClientConfig || hasServerConfig) {
    check('Supabase', true, 'Partially configured', '', true);
  } else {
    check('Supabase', false, '', 'Not configured - image/audio storage will use fallback methods', true);
  }
}

function verifyAuth(): void {
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;

  if (nextAuthSecret && nextAuthSecret.length >= 32) {
    check('NEXTAUTH_SECRET', true, 'Set and valid length', '');
  } else if (nextAuthSecret) {
    check('NEXTAUTH_SECRET', false, '', 'Set but too short (should be at least 32 characters)');
  } else {
    check('NEXTAUTH_SECRET', false, '', 'Not set - authentication will not work');
  }
}

async function main(): Promise<void> {
  console.log('\n🔍 Verifying Environment Variables...\n');
  console.log('=' .repeat(60));

  // Run all verifications
  verifyAuth();
  verifyDatabase();
  verifySupabase();
  await verifyOpenAI();
  await verifyReplicate();

  console.log('\n📋 Results:\n');

  let hasErrors = false;
  let hasWarnings = false;

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${result.name}: ${result.message}`);

    if (result.status === 'fail') hasErrors = true;
    if (result.status === 'warning') hasWarnings = true;
  }

  console.log('\n' + '=' .repeat(60));

  if (hasErrors) {
    console.log('\n❌ Some required environment variables are missing or invalid.');
    console.log('   Please check your .env.local or Vercel environment settings.');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('\n⚠️  All required variables are set, but some optional features may be limited.');
    process.exit(0);
  } else {
    console.log('\n✅ All environment variables verified successfully!');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Verification failed:', error);
  process.exit(1);
});

import { Pool, QueryResult, QueryResultRow } from 'pg';
import { Project, Scene, Character, LoreEntry, SceneSequence, LoreType, ShotBlock, CharacterAppearance, ProjectType } from '@/types';
import { dbLogger } from './logger';

/**
 * Safely parse an integer from an environment variable with validation.
 * Returns the default value if the env var is not set, not a valid number,
 * or not a positive integer.
 */
function parseIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const value = parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : defaultValue;
}

/**
 * Check if Postgres is available - evaluated at runtime, not module load time.
 * This is important for serverless environments where env vars might not be
 * available during module initialization.
 *
 * Checks for connection string OR individual connection components from
 * Vercel's Supabase integration.
 */
function checkPostgresAvailable(): boolean {
  // Check for full connection URLs first
  if (process.env.POSTGRES_URL || process.env.DATABASE_URL) {
    return true;
  }

  // Check for individual Supabase/Vercel Postgres components
  const hasComponents = !!(
    process.env.POSTGRES_HOST &&
    process.env.POSTGRES_USER &&
    process.env.POSTGRES_PASSWORD &&
    process.env.POSTGRES_DATABASE
  );

  return hasComponents;
}

/**
 * Build a connection string from individual Postgres components.
 * Used when POSTGRES_URL is not available but individual components are set.
 */
function buildConnectionString(): string | undefined {
  const host = process.env.POSTGRES_HOST;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DATABASE;

  if (!host || !user || !password || !database) {
    return undefined;
  }

  // Support POSTGRES_PORT env var, default to 6543 for Supabase pooler connections
  // Vercel's Supabase integration uses the pooler (6543), direct connections use 5432
  const port = process.env.POSTGRES_PORT || '6543';

  // URL-encode the password in case it contains special characters
  const encodedPassword = encodeURIComponent(password);

  return `postgres://${user}:${encodedPassword}@${host}:${port}/${database}`;
}

/**
 * Strip sslmode parameter from connection string to avoid conflicts with pg's ssl config.
 * When we explicitly set ssl configuration in the Pool options, the sslmode in the URL
 * can cause conflicts, especially for Supabase pooler connections with self-signed certificates.
 */
function stripSslModeFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    // Remove sslmode parameter if present - we'll control SSL via pg options
    if (parsedUrl.searchParams.has('sslmode')) {
      parsedUrl.searchParams.delete('sslmode');
    }
    return parsedUrl.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Get the database connection URL.
 * Priority: POSTGRES_URL > DATABASE_URL > built from components
 *
 * Note: sslmode is stripped from the URL when running on Vercel to avoid
 * conflicts with our explicit SSL configuration.
 */
function getDatabaseUrl(): string | undefined {
  const isVercel = process.env.VERCEL === '1';

  let url: string | undefined;

  // Prefer explicit connection URLs
  if (process.env.POSTGRES_URL) {
    url = process.env.POSTGRES_URL;
  } else if (process.env.DATABASE_URL) {
    url = process.env.DATABASE_URL;
  } else {
    // Fall back to building from individual components
    url = buildConnectionString();
  }

  // On Vercel, strip sslmode from URL to avoid conflicts with our SSL config
  // This prevents issues with Supabase pooler's self-signed certificates
  if (url && isVercel) {
    url = stripSslModeFromUrl(url);
  }

  return url;
}

// Lazy-initialized connection pool
let pool: Pool | null = null;

/**
 * SSL configuration type for pg Pool.
 * Includes optional checkServerIdentity for bypassing hostname verification.
 * The checkServerIdentity signature matches Node.js TLS API that pg forwards to.
 */
interface SslConfig {
  rejectUnauthorized: boolean;
  ca?: string;
  checkServerIdentity?: (hostname: string, cert: object) => Error | undefined;
}

/**
 * Determine SSL configuration based on environment.
 *
 * Security defaults:
 * - Production (non-Vercel): SSL enabled with strict certificate validation (rejectUnauthorized: true)
 * - Production (Vercel): SSL enabled without strict validation by default since Vercel Postgres
 *   connections are secured at the infrastructure level
 * - Development: No SSL by default, but can opt-in via DB_SSL=true or DB_SSL_CA
 *
 * Configuration options:
 * - DB_SSL=false: Disable SSL entirely (not recommended for production)
 * - DB_SSL=true: Enable SSL in development
 * - DB_SSL_REJECT_UNAUTHORIZED=false: Disable strict certificate validation (not recommended)
 * - DB_SSL_REJECT_UNAUTHORIZED=true: Enable strict certificate validation (overrides defaults)
 * - DB_SSL_CA: Provide a custom CA certificate for validation
 *
 * Note: For Supabase pooler connections (especially on Node.js 24+), we include
 * checkServerIdentity to handle self-signed certificates in the chain.
 */
function getSslConfig(): boolean | SslConfig | undefined {
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = process.env.VERCEL === '1';

  // Allow explicitly disabling SSL (not recommended for production)
  if (process.env.DB_SSL === 'false') {
    if (isProduction) {
      console.warn('[db] SSL disabled via DB_SSL=false - this is not recommended for production');
    }
    return false;
  }

  // In development, no SSL by default unless explicitly enabled or CA provided
  if (!isProduction) {
    // Allow development to opt into SSL via DB_SSL=true or by providing a CA cert
    if (process.env.DB_SSL === 'true' || process.env.DB_SSL_CA) {
      const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
      if (process.env.DB_SSL_CA) {
        return {
          rejectUnauthorized,
          ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n'),
        };
      }
      return { rejectUnauthorized };
    }
    return undefined;
  }

  // Production: determine rejectUnauthorized based on environment and explicit config
  let rejectUnauthorized: boolean;
  const explicitRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED;

  if (explicitRejectUnauthorized !== undefined) {
    // User explicitly configured the setting - use their value
    // Using !== 'false' ensures typos like 'yes' or 'TRUE' default to secure behavior
    rejectUnauthorized = explicitRejectUnauthorized !== 'false';
  } else if (isVercel) {
    // Vercel: default to false since connections are secured at infrastructure level
    rejectUnauthorized = false;
  } else {
    // Other production: default to true for security
    rejectUnauthorized = true;
  }

  // Warn when certificate validation is explicitly disabled in non-Vercel production
  // Skip warning for Vercel since disabled validation is the expected default there
  if (!rejectUnauthorized && explicitRejectUnauthorized !== undefined) {
    console.warn(
      '[db] SSL certificate validation is disabled. ' +
      'Set DB_SSL_REJECT_UNAUTHORIZED=true to enable strict validation.'
    );
  }

  // Build base SSL config
  const sslConfig: SslConfig = { rejectUnauthorized };

  // If a custom CA is provided, use it
  if (process.env.DB_SSL_CA) {
    sslConfig.ca = process.env.DB_SSL_CA.replace(/\\n/g, '\n');
  }

  // For Vercel with Supabase, include checkServerIdentity to fully bypass
  // certificate chain validation. This is necessary because Supabase pooler
  // connections may use self-signed intermediate certificates that Node.js 24+
  // rejects even with rejectUnauthorized: false.
  // This is safe on Vercel because the connection is secured at the infrastructure level.
  if (isVercel && !rejectUnauthorized) {
    // Parameters intentionally unused - we bypass all verification
    sslConfig.checkServerIdentity = (_hostname: string, _cert: object) => undefined;
  }

  return sslConfig;
}

/**
 * Get or create the database connection pool
 */
function getPool(): Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl();
    if (!connectionString) {
      dbLogger.error('Database connection not configured', {
        postgresUrl: !!process.env.POSTGRES_URL,
        databaseUrl: !!process.env.DATABASE_URL,
        postgresHost: !!process.env.POSTGRES_HOST,
        postgresUser: !!process.env.POSTGRES_USER,
        postgresPassword: !!process.env.POSTGRES_PASSWORD,
        postgresDatabase: !!process.env.POSTGRES_DATABASE,
      });
      throw new Error('Database connection not configured. Please set the POSTGRES_URL or DATABASE_URL environment variable.');
    }

    const sslConfig = getSslConfig();
    const poolConfig = {
      max: parseIntEnv('DB_POOL_MAX', 10),
      idleTimeoutMillis: parseIntEnv('DB_IDLE_TIMEOUT', 30000),
      connectionTimeoutMillis: parseIntEnv('DB_CONNECTION_TIMEOUT', 10000),
    };

    dbLogger.info('Creating database connection pool', {
      sslEnabled: sslConfig !== undefined && sslConfig !== false,
      sslRejectUnauthorized: typeof sslConfig === 'object' ? sslConfig.rejectUnauthorized : undefined,
      poolMax: poolConfig.max,
      idleTimeout: poolConfig.idleTimeoutMillis,
      connectionTimeout: poolConfig.connectionTimeoutMillis,
      // Mask connection string but show host for debugging
      connectionHost: connectionString.match(/@([^:\/]+)/)?.[1] || 'unknown',
    });

    pool = new Pool({
      connectionString,
      ssl: sslConfig,
      ...poolConfig,
    });

    // Add error handler for pool-level errors
    pool.on('error', (err) => {
      dbLogger.error('Unexpected pool error', {}, err);
    });

    // Log when pool connects
    pool.on('connect', () => {
      dbLogger.debug('New client connected to pool');
    });
  }
  return pool;
}

/**
 * Close the database connection pool gracefully.
 * Call this on application shutdown to prevent connection leaks.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Execute a query with parameters
 */
export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  const client = getPool();
  const timer = dbLogger.startTimer('query', {
    // Extract first word of query for operation type (SELECT, INSERT, etc.)
    queryType: text.trim().split(/\s+/)[0].toUpperCase(),
    // Truncate query for logging (avoid huge queries in logs)
    query: text.length > 200 ? text.substring(0, 200) + '...' : text,
    paramCount: params?.length ?? 0,
  });

  try {
    const result = await client.query<T>(text, params);
    timer.end({ rowCount: result.rowCount ?? 0 });
    return result;
  } catch (error) {
    timer.error(error);
    throw error;
  }
}

/**
 * Execute a simple query (like SELECT 1)
 */
export async function testConnection(): Promise<void> {
  const timer = dbLogger.startTimer('testConnection');
  try {
    await query('SELECT 1');
    timer.end();
    dbLogger.info('Database connection test successful');
  } catch (error) {
    timer.error(error);
    throw error;
  }
}

// Promise-based singleton to prevent race conditions during initialization
let initPromise: Promise<void> | null = null;

/**
 * Initialize database tables if they don't exist
 * Uses promise-based singleton to prevent race conditions
 */
export async function initializeTables(): Promise<void> {
  if (!checkPostgresAvailable()) return;
  if (initPromise) return initPromise;

  initPromise = doInitializeTables();
  return initPromise;
}

async function doInitializeTables(): Promise<void> {
  dbLogger.info('Initializing database tables', {
    postgresUrlConfigured: !!process.env.POSTGRES_URL,
    databaseUrlConfigured: !!process.env.DATABASE_URL,
    postgresHost: process.env.POSTGRES_HOST ? 'configured' : 'not set',
    nodeEnv: process.env.NODE_ENV,
  });

  const timer = dbLogger.startTimer('initializeTables');

  try {
    // Test basic connectivity first
    dbLogger.debug('Testing database connectivity');
    await query('SELECT 1');
    dbLogger.info('Database connectivity confirmed');

    // Create users table with credits system
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        image TEXT,
        password_hash TEXT,
        credits_remaining INTEGER DEFAULT 100,
        subscription_tier VARCHAR(20) DEFAULT 'free',
        subscription_expires_at TIMESTAMP WITH TIME ZONE,
        lifetime_credits_used INTEGER DEFAULT 0,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Note: Credits columns are managed via migrations (002_add_credits.sql)
    // The CREATE TABLE above includes all columns for new installations
    // Existing databases should run migrations to add credits columns

    // Create credit transactions table for audit trail
    await query(`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        transaction_type VARCHAR(50) NOT NULL,
        description TEXT,
        reference_id VARCHAR(255),
        balance_after INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create projects table
    await query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        project_type VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create scenes table
    await query(`
      CREATE TABLE IF NOT EXISTS scenes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        prompt TEXT NOT NULL,
        image_url TEXT,
        shot_type VARCHAR(100),
        style VARCHAR(100),
        lighting VARCHAR(100),
        mood VARCHAR(100),
        aspect_ratio VARCHAR(50),
        character_ids UUID[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create characters table
    await query(`
      CREATE TABLE IF NOT EXISTS characters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT,
        traits TEXT[],
        appearances JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create lore table
    await query(`
      CREATE TABLE IF NOT EXISTS lore (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        summary TEXT NOT NULL,
        description TEXT,
        tags TEXT[],
        associated_scenes UUID[],
        image_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create sequences table
    await query(`
      CREATE TABLE IF NOT EXISTS sequences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        shots JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes for better query performance
    await query('CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_lore_project_id ON lore(project_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_sequences_project_id ON sequences(project_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id)');

    timer.end();
    dbLogger.info('Database tables initialized successfully');
  } catch (error) {
    // Reset promise to allow retry on next request
    initPromise = null;

    // Log detailed error information for debugging
    const errorContext: Record<string, unknown> = {};
    if (error instanceof Error) {
      errorContext.errorName = error.name;
      if ('code' in error) {
        errorContext.errorCode = (error as { code: string }).code;
      }
      if ('detail' in error) {
        errorContext.errorDetail = (error as { detail: string }).detail;
      }
      if ('hint' in error) {
        errorContext.errorHint = (error as { hint: string }).hint;
      }
      if ('position' in error) {
        errorContext.errorPosition = (error as { position: string }).position;
      }
      if ('routine' in error) {
        errorContext.errorRoutine = (error as { routine: string }).routine;
      }
    }

    timer.error(error, errorContext);
    throw error;
  }
}

/**
 * Check if Postgres is available
 * Uses runtime check to ensure environment variables are evaluated fresh
 */
export function isPostgresAvailable(): boolean {
  return checkPostgresAvailable();
}

// ============================================================================
// User operations
// ============================================================================

/**
 * Retrieve a user by their email address.
 * Email comparison is case-insensitive.
 */
export async function getUserByEmail(email: string): Promise<{
  id: string;
  email: string;
  name: string;
  image: string | null;
  passwordHash: string | null;
  createdAt: string;
  updatedAt: string;
} | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const result = await query(
    'SELECT id, email, name, image, password_hash, created_at, updated_at FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    image: row.image as string | null,
    passwordHash: row.password_hash as string | null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Retrieve a user by their unique ID.
 */
export async function getUserById(id: string): Promise<{
  id: string;
  email: string;
  name: string;
  image: string | null;
  passwordHash: string | null;
  createdAt: string;
  updatedAt: string;
} | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const result = await query(
    'SELECT id, email, name, image, password_hash, created_at, updated_at FROM users WHERE id = $1::uuid',
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    image: row.image as string | null,
    passwordHash: row.password_hash as string | null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Create a new user with the given email, name, and password hash.
 */
export async function createUser(
  email: string,
  name: string,
  passwordHash: string
): Promise<{ id: string; email: string; name: string; createdAt: string; updatedAt: string }> {
  if (!checkPostgresAvailable()) {
    throw new Error('Database not available');
  }

  await initializeTables();

  const result = await query(
    'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, created_at, updated_at',
    [email, name, passwordHash]
  );

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Update a user's profile information.
 * Only provided fields will be updated.
 */
export async function dbUpdateUser(
  id: string,
  updates: Partial<{ name: string; image: string | null }>
): Promise<{
  id: string;
  email: string;
  name: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
} | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  // Build dynamic update query based on provided fields
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex}`);
    values.push(updates.name);
    paramIndex++;
  }

  if (updates.image !== undefined) {
    setClauses.push(`image = $${paramIndex}`);
    values.push(updates.image);
    paramIndex++;
  }

  if (setClauses.length === 0) {
    // No updates provided, just return the existing user
    return await getUserById(id);
  }

  setClauses.push('updated_at = NOW()');
  values.push(id);

  const result = await query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex}::uuid
     RETURNING id, email, name, image, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    image: row.image as string | null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Delete a user from the database.
 * Associated data (projects, credit transactions, etc.) is automatically
 * deleted via ON DELETE CASCADE foreign key constraints.
 */
export async function dbDeleteUser(id: string): Promise<boolean> {
  if (!checkPostgresAvailable()) return false;

  await initializeTables();

  const result = await query(
    'DELETE FROM users WHERE id = $1::uuid RETURNING id',
    [id]
  );

  return result.rows.length > 0;
}

// ============================================================================
// Project operations
// ============================================================================

/**
 * Retrieve all projects, optionally filtered by user ID.
 * Includes related scenes, characters, lore, and sequences.
 */
export async function dbGetAllProjects(userId?: string): Promise<Project[]> {
  if (!checkPostgresAvailable()) return [];

  await initializeTables();

  // Fetch projects
  const projectsResult = userId
    ? await query('SELECT * FROM projects WHERE user_id = $1::uuid ORDER BY updated_at DESC', [userId])
    : await query('SELECT * FROM projects ORDER BY updated_at DESC');

  if (projectsResult.rows.length === 0) {
    return [];
  }

  // Extract project IDs - pg library handles array parameters natively
  const projectIds = projectsResult.rows.map(p => (p as Record<string, unknown>).id as string);

  // Fetch all related data in parallel to avoid N+1 queries
  const [scenesResult, charactersResult, loreResult, sequencesResult] = await Promise.all([
    query(`SELECT * FROM scenes WHERE project_id = ANY($1::uuid[]) ORDER BY created_at ASC`, [projectIds]),
    query(`SELECT * FROM characters WHERE project_id = ANY($1::uuid[]) ORDER BY created_at ASC`, [projectIds]),
    query(`SELECT * FROM lore WHERE project_id = ANY($1::uuid[]) ORDER BY created_at ASC`, [projectIds]),
    query(`SELECT * FROM sequences WHERE project_id = ANY($1::uuid[]) ORDER BY created_at ASC`, [projectIds]),
  ]);

  // Group related data by project_id
  const scenesByProject = new Map<string, Scene[]>();
  for (const row of scenesResult.rows) {
    const s = row as Record<string, unknown>;
    const scenes = scenesByProject.get(s.project_id as string) || [];
    scenes.push({
      id: s.id as string,
      projectId: s.project_id as string,
      prompt: s.prompt as string,
      imageUrl: (s.image_url as string | null) ?? null,
      metadata: {
        shotType: s.shot_type as string | undefined,
        style: s.style as string | undefined,
        lighting: s.lighting as string | undefined,
        mood: s.mood as string | undefined,
        aspectRatio: s.aspect_ratio as string | undefined,
      },
      characterIds: s.character_ids as string[] | undefined,
      createdAt: (s.created_at as Date).toISOString(),
      updatedAt: (s.updated_at as Date).toISOString(),
    });
    scenesByProject.set(s.project_id as string, scenes);
  }

  const charactersByProject = new Map<string, Character[]>();
  for (const row of charactersResult.rows) {
    const c = row as Record<string, unknown>;
    const characters = charactersByProject.get(c.project_id as string) || [];
    characters.push({
      id: c.id as string,
      projectId: c.project_id as string,
      name: c.name as string,
      description: (c.description as string) || '',
      imageUrl: c.image_url as string | undefined,
      traits: (c.traits as string[]) || [],
      appearances: (c.appearances as CharacterAppearance[]) || [],
      createdAt: (c.created_at as Date).toISOString(),
      updatedAt: (c.updated_at as Date).toISOString(),
    });
    charactersByProject.set(c.project_id as string, characters);
  }

  const loreByProject = new Map<string, LoreEntry[]>();
  for (const row of loreResult.rows) {
    const l = row as Record<string, unknown>;
    const lore = loreByProject.get(l.project_id as string) || [];
    lore.push({
      id: l.id as string,
      projectId: l.project_id as string,
      type: l.type as LoreType,
      name: l.name as string,
      summary: l.summary as string,
      description: l.description as string | undefined,
      tags: (l.tags as string[]) || [],
      associatedScenes: (l.associated_scenes as string[]) || [],
      imageUrl: l.image_url as string | undefined,
      createdAt: (l.created_at as Date).toISOString(),
      updatedAt: (l.updated_at as Date).toISOString(),
    });
    loreByProject.set(l.project_id as string, lore);
  }

  const sequencesByProject = new Map<string, SceneSequence[]>();
  for (const row of sequencesResult.rows) {
    const seq = row as Record<string, unknown>;
    const sequences = sequencesByProject.get(seq.project_id as string) || [];
    sequences.push({
      id: seq.id as string,
      projectId: seq.project_id as string,
      name: seq.name as string,
      description: seq.description as string | undefined,
      shots: (seq.shots as ShotBlock[]) || [],
      createdAt: (seq.created_at as Date).toISOString(),
      updatedAt: (seq.updated_at as Date).toISOString(),
    });
    sequencesByProject.set(seq.project_id as string, sequences);
  }

  // Assemble projects with their related data
  return projectsResult.rows.map(row => {
    const p = row as Record<string, unknown>;
    return {
      id: p.id as string,
      userId: p.user_id as string | undefined,
      name: p.name as string,
      description: p.description as string | undefined,
      projectType: p.project_type as ProjectType | undefined,
      scenes: scenesByProject.get(p.id as string) || [],
      characters: charactersByProject.get(p.id as string) || [],
      lore: loreByProject.get(p.id as string) || [],
      sequences: sequencesByProject.get(p.id as string) || [],
      createdAt: (p.created_at as Date).toISOString(),
      updatedAt: (p.updated_at as Date).toISOString(),
    };
  });
}

/**
 * Retrieve a project by its unique ID.
 * Includes related scenes, characters, lore, and sequences.
 */
export async function dbGetProjectById(id: string): Promise<Project | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const projectResult = await query('SELECT * FROM projects WHERE id = $1::uuid', [id]);
  if (projectResult.rows.length === 0) return null;

  const row = projectResult.rows[0] as Record<string, unknown>;

  // Fetch related data
  const [scenesResult, charactersResult, loreResult, sequencesResult] = await Promise.all([
    query('SELECT * FROM scenes WHERE project_id = $1::uuid ORDER BY created_at ASC', [id]),
    query('SELECT * FROM characters WHERE project_id = $1::uuid ORDER BY created_at ASC', [id]),
    query('SELECT * FROM lore WHERE project_id = $1::uuid ORDER BY created_at ASC', [id]),
    query('SELECT * FROM sequences WHERE project_id = $1::uuid ORDER BY created_at ASC', [id]),
  ]);

  const scenes: Scene[] = scenesResult.rows.map(r => {
    const s = r as Record<string, unknown>;
    return {
      id: s.id as string,
      projectId: s.project_id as string,
      prompt: s.prompt as string,
      imageUrl: (s.image_url as string | null) ?? null,
      metadata: {
        shotType: s.shot_type as string | undefined,
        style: s.style as string | undefined,
        lighting: s.lighting as string | undefined,
        mood: s.mood as string | undefined,
        aspectRatio: s.aspect_ratio as string | undefined,
      },
      characterIds: s.character_ids as string[] | undefined,
      createdAt: (s.created_at as Date).toISOString(),
      updatedAt: (s.updated_at as Date).toISOString(),
    };
  });

  const characters: Character[] = charactersResult.rows.map(r => {
    const c = r as Record<string, unknown>;
    return {
      id: c.id as string,
      projectId: c.project_id as string,
      name: c.name as string,
      description: (c.description as string) || '',
      imageUrl: c.image_url as string | undefined,
      traits: (c.traits as string[]) || [],
      appearances: (c.appearances as CharacterAppearance[]) || [],
      createdAt: (c.created_at as Date).toISOString(),
      updatedAt: (c.updated_at as Date).toISOString(),
    };
  });

  const lore: LoreEntry[] = loreResult.rows.map(r => {
    const l = r as Record<string, unknown>;
    return {
      id: l.id as string,
      projectId: l.project_id as string,
      type: l.type as LoreType,
      name: l.name as string,
      summary: l.summary as string,
      description: l.description as string | undefined,
      tags: (l.tags as string[]) || [],
      associatedScenes: (l.associated_scenes as string[]) || [],
      imageUrl: l.image_url as string | undefined,
      createdAt: (l.created_at as Date).toISOString(),
      updatedAt: (l.updated_at as Date).toISOString(),
    };
  });

  const sequences: SceneSequence[] = sequencesResult.rows.map(r => {
    const seq = r as Record<string, unknown>;
    return {
      id: seq.id as string,
      projectId: seq.project_id as string,
      name: seq.name as string,
      description: seq.description as string | undefined,
      shots: (seq.shots as ShotBlock[]) || [],
      createdAt: (seq.created_at as Date).toISOString(),
      updatedAt: (seq.updated_at as Date).toISOString(),
    };
  });

  return {
    id: row.id as string,
    userId: row.user_id as string | undefined,
    name: row.name as string,
    description: row.description as string | undefined,
    projectType: row.project_type as ProjectType | undefined,
    scenes,
    characters,
    lore,
    sequences,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Create a new project with the given name and optional description.
 */
export async function dbCreateProject(
  name: string,
  description?: string,
  userId?: string
): Promise<Project> {
  if (!checkPostgresAvailable()) {
    throw new Error('Database not available');
  }

  await initializeTables();

  const result = await query(
    'INSERT INTO projects (name, description, user_id) VALUES ($1, $2, $3::uuid) RETURNING *',
    [name, description || null, userId || null]
  );

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    userId: row.user_id as string | undefined,
    name: row.name as string,
    description: row.description as string | undefined,
    scenes: [],
    characters: [],
    lore: [],
    sequences: [],
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Update a project's properties.
 * Only provided fields will be updated.
 */
export async function dbUpdateProject(
  id: string,
  updates: Partial<Pick<Project, 'name' | 'description' | 'projectType'>>
): Promise<Project | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  await query(
    `UPDATE projects SET
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      project_type = COALESCE($3, project_type),
      updated_at = NOW()
    WHERE id = $4::uuid`,
    [updates.name || null, updates.description || null, updates.projectType || null, id]
  );

  return dbGetProjectById(id);
}

/**
 * Delete a project and all its related data (cascades to scenes, characters, etc.).
 */
export async function dbDeleteProject(id: string): Promise<boolean> {
  if (!checkPostgresAvailable()) return false;

  await initializeTables();

  const result = await query('DELETE FROM projects WHERE id = $1::uuid', [id]);
  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Scene operations
// ============================================================================

/**
 * Add a new scene to a project.
 */
export async function dbAddScene(
  projectId: string,
  prompt: string,
  imageUrl: string | null,
  metadata?: Scene['metadata'],
  characterIds?: string[]
): Promise<Scene | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const result = await query(
    `INSERT INTO scenes (project_id, prompt, image_url, shot_type, style, lighting, mood, aspect_ratio, character_ids)
    VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::uuid[])
    RETURNING *`,
    [
      projectId,
      prompt,
      imageUrl,
      metadata?.shotType || null,
      metadata?.style || null,
      metadata?.lighting || null,
      metadata?.mood || null,
      metadata?.aspectRatio || null,
      characterIds || null,
    ]
  );

  // Update project's updated_at
  await query('UPDATE projects SET updated_at = NOW() WHERE id = $1::uuid', [projectId]);

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    prompt: row.prompt as string,
    imageUrl: (row.image_url as string | null) ?? null,
    metadata: {
      shotType: row.shot_type as string | undefined,
      style: row.style as string | undefined,
      lighting: row.lighting as string | undefined,
      mood: row.mood as string | undefined,
      aspectRatio: row.aspect_ratio as string | undefined,
    },
    characterIds: row.character_ids as string[] | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Retrieve a scene by its ID within a project.
 */
export async function dbGetSceneById(projectId: string, sceneId: string): Promise<Scene | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const result = await query(
    'SELECT * FROM scenes WHERE id = $1::uuid AND project_id = $2::uuid',
    [sceneId, projectId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    prompt: row.prompt as string,
    imageUrl: (row.image_url as string | null) ?? null,
    metadata: {
      shotType: row.shot_type as string | undefined,
      style: row.style as string | undefined,
      lighting: row.lighting as string | undefined,
      mood: row.mood as string | undefined,
      aspectRatio: row.aspect_ratio as string | undefined,
    },
    characterIds: row.character_ids as string[] | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Update a scene's properties.
 */
export async function dbUpdateScene(
  projectId: string,
  sceneId: string,
  updates: Partial<Pick<Scene, 'prompt' | 'imageUrl' | 'metadata'>>
): Promise<Scene | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  await query(
    `UPDATE scenes SET
      prompt = COALESCE($1, prompt),
      image_url = COALESCE($2, image_url),
      shot_type = COALESCE($3, shot_type),
      style = COALESCE($4, style),
      lighting = COALESCE($5, lighting),
      mood = COALESCE($6, mood),
      aspect_ratio = COALESCE($7, aspect_ratio),
      updated_at = NOW()
    WHERE id = $8::uuid AND project_id = $9::uuid`,
    [
      updates.prompt || null,
      updates.imageUrl || null,
      updates.metadata?.shotType || null,
      updates.metadata?.style || null,
      updates.metadata?.lighting || null,
      updates.metadata?.mood || null,
      updates.metadata?.aspectRatio || null,
      sceneId,
      projectId,
    ]
  );

  await query('UPDATE projects SET updated_at = NOW() WHERE id = $1::uuid', [projectId]);

  return dbGetSceneById(projectId, sceneId);
}

/**
 * Delete a scene from a project.
 */
export async function dbDeleteScene(projectId: string, sceneId: string): Promise<boolean> {
  if (!checkPostgresAvailable()) return false;

  await initializeTables();

  const result = await query(
    'DELETE FROM scenes WHERE id = $1::uuid AND project_id = $2::uuid',
    [sceneId, projectId]
  );

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    await query('UPDATE projects SET updated_at = NOW() WHERE id = $1::uuid', [projectId]);
  }

  return deleted;
}

// ============================================================================
// Character operations
// ============================================================================

/**
 * Add a new character to a project.
 */
export async function dbAddCharacter(
  projectId: string,
  name: string,
  description: string,
  traits: string[] = [],
  imageUrl?: string
): Promise<Character | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const result = await query(
    `INSERT INTO characters (project_id, name, description, traits, image_url)
    VALUES ($1::uuid, $2, $3, $4::text[], $5)
    RETURNING *`,
    [projectId, name, description, traits, imageUrl || null]
  );

  await query('UPDATE projects SET updated_at = NOW() WHERE id = $1::uuid', [projectId]);

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    imageUrl: row.image_url as string | undefined,
    traits: (row.traits as string[]) || [],
    appearances: (row.appearances as CharacterAppearance[]) || [],
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Retrieve a character by its ID within a project.
 */
export async function dbGetCharacterById(projectId: string, characterId: string): Promise<Character | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const result = await query(
    'SELECT * FROM characters WHERE id = $1::uuid AND project_id = $2::uuid',
    [characterId, projectId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    imageUrl: row.image_url as string | undefined,
    traits: (row.traits as string[]) || [],
    appearances: (row.appearances as CharacterAppearance[]) || [],
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Update a character's properties.
 */
export async function dbUpdateCharacter(
  projectId: string,
  characterId: string,
  updates: Partial<Pick<Character, 'name' | 'description' | 'traits' | 'imageUrl' | 'appearances'>>
): Promise<Character | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const appearancesValue = updates.appearances !== undefined ? JSON.stringify(updates.appearances) : null;

  await query(
    `UPDATE characters SET
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      traits = COALESCE($3::text[], traits),
      image_url = COALESCE($4, image_url),
      appearances = COALESCE($5::jsonb, appearances),
      updated_at = NOW()
    WHERE id = $6::uuid AND project_id = $7::uuid`,
    [
      updates.name || null,
      updates.description || null,
      updates.traits ?? null,
      updates.imageUrl || null,
      appearancesValue,
      characterId,
      projectId,
    ]
  );

  await query('UPDATE projects SET updated_at = NOW() WHERE id = $1::uuid', [projectId]);

  return dbGetCharacterById(projectId, characterId);
}

/**
 * Delete a character from a project.
 */
export async function dbDeleteCharacter(projectId: string, characterId: string): Promise<boolean> {
  if (!checkPostgresAvailable()) return false;

  await initializeTables();

  const result = await query(
    'DELETE FROM characters WHERE id = $1::uuid AND project_id = $2::uuid',
    [characterId, projectId]
  );

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    await query('UPDATE projects SET updated_at = NOW() WHERE id = $1::uuid', [projectId]);
  }

  return deleted;
}

// ============================================================================
// Lore operations
// ============================================================================

/**
 * Add a new lore entry to a project.
 */
export async function dbAddLore(
  projectId: string,
  type: LoreType,
  name: string,
  summary: string,
  description?: string,
  tags?: string[]
): Promise<LoreEntry | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const result = await query(
    `INSERT INTO lore (project_id, type, name, summary, description, tags)
    VALUES ($1::uuid, $2, $3, $4, $5, $6::text[])
    RETURNING *`,
    [projectId, type, name, summary, description || null, tags || []]
  );

  await query('UPDATE projects SET updated_at = NOW() WHERE id = $1::uuid', [projectId]);

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    type: row.type as LoreType,
    name: row.name as string,
    summary: row.summary as string,
    description: row.description as string | undefined,
    tags: (row.tags as string[]) || [],
    associatedScenes: (row.associated_scenes as string[]) || [],
    imageUrl: row.image_url as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Retrieve a lore entry by its ID within a project.
 */
export async function dbGetLoreById(projectId: string, loreId: string): Promise<LoreEntry | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const result = await query(
    'SELECT * FROM lore WHERE id = $1::uuid AND project_id = $2::uuid',
    [loreId, projectId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    type: row.type as LoreType,
    name: row.name as string,
    summary: row.summary as string,
    description: row.description as string | undefined,
    tags: (row.tags as string[]) || [],
    associatedScenes: (row.associated_scenes as string[]) || [],
    imageUrl: row.image_url as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Update a lore entry's properties.
 */
export async function dbUpdateLore(
  projectId: string,
  loreId: string,
  updates: Partial<Pick<LoreEntry, 'name' | 'summary' | 'description' | 'tags' | 'associatedScenes' | 'imageUrl'>>
): Promise<LoreEntry | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  await query(
    `UPDATE lore SET
      name = COALESCE($1, name),
      summary = COALESCE($2, summary),
      description = COALESCE($3, description),
      tags = COALESCE($4::text[], tags),
      associated_scenes = COALESCE($5::uuid[], associated_scenes),
      image_url = COALESCE($6, image_url),
      updated_at = NOW()
    WHERE id = $7::uuid AND project_id = $8::uuid`,
    [
      updates.name || null,
      updates.summary || null,
      updates.description || null,
      updates.tags ?? null,
      updates.associatedScenes ?? null,
      updates.imageUrl || null,
      loreId,
      projectId,
    ]
  );

  await query('UPDATE projects SET updated_at = NOW() WHERE id = $1::uuid', [projectId]);

  return dbGetLoreById(projectId, loreId);
}

/**
 * Delete a lore entry from a project.
 */
export async function dbDeleteLore(projectId: string, loreId: string): Promise<boolean> {
  if (!checkPostgresAvailable()) return false;

  await initializeTables();

  const result = await query(
    'DELETE FROM lore WHERE id = $1::uuid AND project_id = $2::uuid',
    [loreId, projectId]
  );

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    await query('UPDATE projects SET updated_at = NOW() WHERE id = $1::uuid', [projectId]);
  }

  return deleted;
}

/**
 * Retrieve all lore entries for a project, optionally filtered by type.
 */
export async function dbGetProjectLore(projectId: string, type?: LoreType): Promise<LoreEntry[]> {
  if (!checkPostgresAvailable()) return [];

  await initializeTables();

  let result;
  if (type) {
    result = await query(
      'SELECT * FROM lore WHERE project_id = $1::uuid AND type = $2 ORDER BY created_at ASC',
      [projectId, type]
    );
  } else {
    result = await query(
      'SELECT * FROM lore WHERE project_id = $1::uuid ORDER BY created_at ASC',
      [projectId]
    );
  }

  return result.rows.map(r => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      type: row.type as LoreType,
      name: row.name as string,
      summary: row.summary as string,
      description: row.description as string | undefined,
      tags: (row.tags as string[]) || [],
      associatedScenes: (row.associated_scenes as string[]) || [],
      imageUrl: row.image_url as string | undefined,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  });
}

// ============================================================================
// Sequence operations
// ============================================================================

/**
 * Add a new sequence to a project.
 */
export async function dbAddSequence(
  projectId: string,
  name: string,
  description?: string
): Promise<SceneSequence | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const result = await query(
    `INSERT INTO sequences (project_id, name, description)
    VALUES ($1::uuid, $2, $3)
    RETURNING *`,
    [projectId, name, description || null]
  );

  await query('UPDATE projects SET updated_at = NOW() WHERE id = $1::uuid', [projectId]);

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    shots: (row.shots as ShotBlock[]) || [],
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Update a sequence's properties.
 */
export async function dbUpdateSequence(
  projectId: string,
  sequenceId: string,
  updates: Partial<Pick<SceneSequence, 'name' | 'description' | 'shots'>>
): Promise<SceneSequence | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  await query(
    `UPDATE sequences SET
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      shots = COALESCE($3::jsonb, shots),
      updated_at = NOW()
    WHERE id = $4::uuid AND project_id = $5::uuid`,
    [
      updates.name || null,
      updates.description || null,
      updates.shots ? JSON.stringify(updates.shots) : null,
      sequenceId,
      projectId,
    ]
  );

  await query('UPDATE projects SET updated_at = NOW() WHERE id = $1::uuid', [projectId]);

  const result = await query(
    'SELECT * FROM sequences WHERE id = $1::uuid AND project_id = $2::uuid',
    [sequenceId, projectId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    shots: (row.shots as ShotBlock[]) || [],
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Delete a sequence from a project.
 */
export async function dbDeleteSequence(projectId: string, sequenceId: string): Promise<boolean> {
  if (!checkPostgresAvailable()) return false;

  await initializeTables();

  const result = await query(
    'DELETE FROM sequences WHERE id = $1::uuid AND project_id = $2::uuid',
    [sequenceId, projectId]
  );

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    await query('UPDATE projects SET updated_at = NOW() WHERE id = $1::uuid', [projectId]);
  }

  return deleted;
}

// ============================================================================
// Credits operations
// ============================================================================

export interface UserCredits {
  id: string;
  creditsRemaining: number;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  subscriptionExpiresAt: string | null;
  lifetimeCreditsUsed: number;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  transactionType: 'purchase' | 'subscription' | 'generation' | 'refund' | 'bonus' | 'adjustment';
  description: string | null;
  referenceId: string | null;
  balanceAfter: number;
  createdAt: string;
}

/**
 * Custom error for credit operations.
 */
export class CreditError extends Error {
  constructor(
    message: string,
    public code: 'USER_NOT_FOUND' | 'INSUFFICIENT_CREDITS' | 'INVALID_AMOUNT' | 'DB_UNAVAILABLE'
  ) {
    super(message);
    this.name = 'CreditError';
  }
}

/**
 * Get a user's credit information.
 */
export async function getUserCredits(userId: string): Promise<UserCredits | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const result = await query(
    `SELECT id, credits_remaining, subscription_tier, subscription_expires_at, lifetime_credits_used
     FROM users WHERE id = $1::uuid`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    creditsRemaining: (row.credits_remaining as number) ?? 100,
    subscriptionTier: (row.subscription_tier as 'free' | 'pro' | 'enterprise') ?? 'free',
    subscriptionExpiresAt: row.subscription_expires_at ? (row.subscription_expires_at as Date).toISOString() : null,
    lifetimeCreditsUsed: (row.lifetime_credits_used as number) ?? 0,
  };
}

/**
 * Deduct credits from a user atomically.
 * Returns the updated credits info if successful.
 * @throws CreditError with code 'DB_UNAVAILABLE' if database is not configured
 * @throws CreditError with code 'USER_NOT_FOUND' if user doesn't exist
 * @throws CreditError with code 'INSUFFICIENT_CREDITS' if user doesn't have enough credits
 * @throws CreditError with code 'INVALID_AMOUNT' if amount is not positive
 */
export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
  referenceId?: string,
  transactionType: 'generation' | 'adjustment' = 'generation'
): Promise<UserCredits> {
  if (!checkPostgresAvailable()) {
    throw new CreditError('Database not available', 'DB_UNAVAILABLE');
  }
  if (amount <= 0) {
    throw new CreditError('Amount must be positive', 'INVALID_AMOUNT');
  }

  await initializeTables();

  // Use a transaction to ensure atomic deduction
  const dbPool = getPool();
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    // Lock the user row and check credits
    const checkResult = await client.query(
      `SELECT id, credits_remaining, subscription_tier, subscription_expires_at, lifetime_credits_used
       FROM users WHERE id = $1::uuid FOR UPDATE`,
      [userId]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new CreditError('User not found', 'USER_NOT_FOUND');
    }

    const currentCredits = (checkResult.rows[0] as Record<string, unknown>).credits_remaining as number;
    if (currentCredits < amount) {
      await client.query('ROLLBACK');
      throw new CreditError(
        `Insufficient credits: ${currentCredits} available, ${amount} required`,
        'INSUFFICIENT_CREDITS'
      );
    }

    const newBalance = currentCredits - amount;

    // Update user credits
    await client.query(
      `UPDATE users SET
         credits_remaining = $1,
         lifetime_credits_used = lifetime_credits_used + $2,
         updated_at = NOW()
       WHERE id = $3::uuid`,
      [newBalance, amount, userId]
    );

    // Log the transaction
    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, transaction_type, description, reference_id, balance_after)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
      [userId, -amount, transactionType, description, referenceId || null, newBalance]
    );

    await client.query('COMMIT');

    // Return updated credits
    const row = checkResult.rows[0] as Record<string, unknown>;
    return {
      id: row.id as string,
      creditsRemaining: newBalance,
      subscriptionTier: (row.subscription_tier as 'free' | 'pro' | 'enterprise') ?? 'free',
      subscriptionExpiresAt: row.subscription_expires_at ? (row.subscription_expires_at as Date).toISOString() : null,
      lifetimeCreditsUsed: ((row.lifetime_credits_used as number) ?? 0) + amount,
    };
  } catch (error) {
    // Don't rollback if it's a CreditError (already rolled back)
    if (!(error instanceof CreditError)) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Add credits to a user (for purchases, bonuses, etc.).
 */
export async function addCredits(
  userId: string,
  amount: number,
  transactionType: 'purchase' | 'subscription' | 'bonus' | 'refund' | 'adjustment',
  description: string,
  referenceId?: string
): Promise<UserCredits | null> {
  if (!checkPostgresAvailable()) return null;
  if (amount <= 0) throw new Error('Amount must be positive');

  await initializeTables();

  const dbPool = getPool();
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    // Lock and update user credits
    const result = await client.query(
      `UPDATE users SET
         credits_remaining = credits_remaining + $1,
         updated_at = NOW()
       WHERE id = $2::uuid
       RETURNING id, credits_remaining, subscription_tier, subscription_expires_at, lifetime_credits_used`,
      [amount, userId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const row = result.rows[0] as Record<string, unknown>;
    const newBalance = row.credits_remaining as number;

    // Log the transaction
    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, transaction_type, description, reference_id, balance_after)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
      [userId, amount, transactionType, description, referenceId || null, newBalance]
    );

    await client.query('COMMIT');

    return {
      id: row.id as string,
      creditsRemaining: newBalance,
      subscriptionTier: (row.subscription_tier as 'free' | 'pro' | 'enterprise') ?? 'free',
      subscriptionExpiresAt: row.subscription_expires_at ? (row.subscription_expires_at as Date).toISOString() : null,
      lifetimeCreditsUsed: (row.lifetime_credits_used as number) ?? 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get credit transaction history for a user.
 */
export async function getCreditTransactions(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<CreditTransaction[]> {
  if (!checkPostgresAvailable()) return [];

  await initializeTables();

  const result = await query(
    `SELECT id, user_id, amount, transaction_type, description, reference_id, balance_after, created_at
     FROM credit_transactions
     WHERE user_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return result.rows.map(r => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      userId: row.user_id as string,
      amount: row.amount as number,
      transactionType: row.transaction_type as CreditTransaction['transactionType'],
      description: row.description as string | null,
      referenceId: row.reference_id as string | null,
      balanceAfter: row.balance_after as number,
      createdAt: (row.created_at as Date).toISOString(),
    };
  });
}

/**
 * Update user subscription tier.
 */
export async function updateUserSubscription(
  userId: string,
  tier: 'free' | 'pro' | 'enterprise',
  expiresAt: Date | null,
  stripeSubscriptionId?: string
): Promise<UserCredits | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const result = await query(
    `UPDATE users SET
       subscription_tier = $1,
       subscription_expires_at = $2,
       stripe_subscription_id = COALESCE($3, stripe_subscription_id),
       updated_at = NOW()
     WHERE id = $4::uuid
     RETURNING id, credits_remaining, subscription_tier, subscription_expires_at, lifetime_credits_used`,
    [tier, expiresAt, stripeSubscriptionId || null, userId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    creditsRemaining: (row.credits_remaining as number) ?? 100,
    subscriptionTier: (row.subscription_tier as 'free' | 'pro' | 'enterprise') ?? 'free',
    subscriptionExpiresAt: row.subscription_expires_at ? (row.subscription_expires_at as Date).toISOString() : null,
    lifetimeCreditsUsed: (row.lifetime_credits_used as number) ?? 0,
  };
}

import { Pool, QueryResult, QueryResultRow } from 'pg';
import { Project, Scene, Character, LoreEntry, SceneSequence, LoreType, ShotBlock, CharacterAppearance, ProjectType } from '@/types';

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
 */
function checkPostgresAvailable(): boolean {
  return !!process.env.POSTGRES_URL || !!process.env.DATABASE_URL;
}

/**
 * Get the database connection URL
 */
function getDatabaseUrl(): string | undefined {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL;
}

// Lazy-initialized connection pool
let pool: Pool | null = null;

/**
 * Get or create the database connection pool
 */
function getPool(): Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl();
    if (!connectionString) {
      throw new Error('Database connection not configured. Please set the POSTGRES_URL or DATABASE_URL environment variable.');
    }
    // SSL configuration: Enable in production with certificate validation by default
    // Set DB_SSL_REJECT_UNAUTHORIZED=false only if using self-signed certs (not recommended)
    const sslConfig = process.env.NODE_ENV === 'production'
      ? {
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
          // Normalize PEM certificate: convert literal \n sequences to actual newlines
          ...(process.env.DB_SSL_CA
            ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') }
            : {}),
        }
      : undefined;

    pool = new Pool({
      connectionString,
      ssl: sslConfig,
      max: parseIntEnv('DB_POOL_MAX', 10),
      idleTimeoutMillis: parseIntEnv('DB_IDLE_TIMEOUT', 30000),
      connectionTimeoutMillis: parseIntEnv('DB_CONNECTION_TIMEOUT', 10000),
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
async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  const client = getPool();
  return client.query<T>(text, params);
}

/**
 * Execute a simple query (like SELECT 1)
 */
export async function testConnection(): Promise<void> {
  await query('SELECT 1');
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
  console.log('[db] Initializing database tables...');
  console.log('[db] POSTGRES_URL configured:', !!process.env.POSTGRES_URL);
  console.log('[db] DATABASE_URL configured:', !!process.env.DATABASE_URL);

  try {
    // Test basic connectivity first
    console.log('[db] Testing database connectivity...');
    await query('SELECT 1');
    console.log('[db] Database connectivity confirmed');

    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        image TEXT,
        password_hash TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

    console.log('[db] Database tables initialized successfully');
  } catch (error) {
    // Reset promise to allow retry on next request
    initPromise = null;

    // Log detailed error information for debugging
    console.error('[db] Failed to initialize tables');
    if (error instanceof Error) {
      console.error('[db] Error name:', error.name);
      console.error('[db] Error message:', error.message);
      if ('code' in error) {
        console.error('[db] Error code:', (error as { code: string }).code);
      }
      if ('detail' in error) {
        console.error('[db] Error detail:', (error as { detail: string }).detail);
      }
    } else {
      console.error('[db] Unknown error type:', error);
    }

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

export async function getUserById(id: string): Promise<{
  id: string;
  email: string;
  name: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
} | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const result = await query(
    'SELECT id, email, name, image, created_at, updated_at FROM users WHERE id = $1::uuid',
    [id]
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

// ============================================================================
// Project operations
// ============================================================================

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

export async function dbDeleteProject(id: string): Promise<boolean> {
  if (!checkPostgresAvailable()) return false;

  await initializeTables();

  const result = await query('DELETE FROM projects WHERE id = $1::uuid', [id]);
  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Scene operations
// ============================================================================

export async function dbAddScene(
  projectId: string,
  prompt: string,
  imageUrl: string | null,
  metadata?: Scene['metadata']
): Promise<Scene | null> {
  if (!checkPostgresAvailable()) return null;

  await initializeTables();

  const result = await query(
    `INSERT INTO scenes (project_id, prompt, image_url, shot_type, style, lighting, mood, aspect_ratio)
    VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
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
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

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

import { sql } from '@vercel/postgres';
import { Project, Scene, Character, LoreEntry, SceneSequence, LoreType } from '@/types';

/**
 * UUID regex pattern for validation (accepts standard UUID format)
 * More permissive than strict version/variant checking to handle all valid PostgreSQL UUIDs
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a string is a valid UUID
 */
function isValidUUID(value: string): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Safely convert a string array to PostgreSQL array literal format.
 * Properly escapes backslashes and quotes to prevent injection.
 * Filters out null/undefined values.
 */
function toPostgresArray(arr: string[]): string {
  if (!arr || arr.length === 0) return '{}';
  const escaped = arr
    .filter((s): s is string => s != null)
    .map(s => {
      // Escape backslashes first, then quotes
      const safe = s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `"${safe}"`;
    });
  return `{${escaped.join(',')}}`;
}

/**
 * Safely convert a UUID array to PostgreSQL array literal format.
 * Validates that all values are valid UUIDs to prevent injection.
 * Logs a warning if invalid UUIDs are filtered out.
 */
function toPostgresUUIDArray(arr: string[]): string {
  if (!arr || arr.length === 0) return '{}';
  const validUUIDs = arr.filter(isValidUUID);
  // Warn about filtered invalid UUIDs to aid debugging
  if (validUUIDs.length !== arr.length) {
    const invalidUUIDs = arr.filter(id => !isValidUUID(id));
    console.warn('[db] Filtered invalid UUIDs from array:', invalidUUIDs);
  }
  return `{${validUUIDs.join(',')}}`;
}

// Check if we're using Vercel Postgres (production) or file storage (development)
const usePostgres = !!process.env.POSTGRES_URL;

// Promise-based singleton to prevent race conditions during initialization
let initPromise: Promise<void> | null = null;

/**
 * Initialize database tables if they don't exist
 * Uses promise-based singleton to prevent race conditions
 */
export async function initializeTables(): Promise<void> {
  if (!usePostgres) return;
  if (initPromise) return initPromise;

  initPromise = doInitializeTables();
  return initPromise;
}

async function doInitializeTables(): Promise<void> {

  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        image TEXT,
        password_hash TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create projects table
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        project_type VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create scenes table
    await sql`
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
    `;

    // Create characters table
    await sql`
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
    `;

    // Create lore table
    await sql`
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
    `;

    // Create sequences table
    await sql`
      CREATE TABLE IF NOT EXISTS sequences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        shots JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create indexes for better query performance
    await sql`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_lore_project_id ON lore(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sequences_project_id ON sequences(project_id)`;

    console.log('[db] Database tables initialized successfully');
  } catch (error) {
    // Reset promise to allow retry on next request
    initPromise = null;
    console.error('[db] Failed to initialize tables:', error);
    throw error;
  }
}

/**
 * Check if Postgres is available
 */
export function isPostgresAvailable(): boolean {
  return usePostgres;
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
} | null> {
  if (!usePostgres) return null;

  await initializeTables();

  const result = await sql`
    SELECT id, email, name, image, password_hash
    FROM users WHERE email = ${email}
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    passwordHash: row.password_hash,
  };
}

export async function getUserById(id: string): Promise<{
  id: string;
  email: string;
  name: string;
  image: string | null;
} | null> {
  if (!usePostgres) return null;

  await initializeTables();

  const result = await sql`
    SELECT id, email, name, image FROM users WHERE id = ${id}::uuid
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
  };
}

export async function createUser(
  email: string,
  name: string,
  passwordHash: string
): Promise<{ id: string; email: string; name: string }> {
  if (!usePostgres) {
    throw new Error('Database not available');
  }

  await initializeTables();

  const result = await sql`
    INSERT INTO users (email, name, password_hash)
    VALUES (${email}, ${name}, ${passwordHash})
    RETURNING id, email, name
  `;

  return result.rows[0] as { id: string; email: string; name: string };
}

// ============================================================================
// Project operations
// ============================================================================

export async function dbGetAllProjects(userId?: string): Promise<Project[]> {
  if (!usePostgres) return [];

  await initializeTables();

  // Fetch projects
  const projectsResult = userId
    ? await sql`SELECT * FROM projects WHERE user_id = ${userId}::uuid ORDER BY updated_at DESC`
    : await sql`SELECT * FROM projects ORDER BY updated_at DESC`;

  if (projectsResult.rows.length === 0) {
    return [];
  }

  // Create a validated PostgreSQL UUID array literal for use in queries
  const projectIds = projectsResult.rows.map(p => p.id);
  const projectIdsArray = toPostgresUUIDArray(projectIds);

  // Fetch all related data in parallel to avoid N+1 queries
  const [scenesResult, charactersResult, loreResult, sequencesResult] = await Promise.all([
    sql`SELECT * FROM scenes WHERE project_id = ANY(${projectIdsArray}::uuid[]) ORDER BY created_at ASC`,
    sql`SELECT * FROM characters WHERE project_id = ANY(${projectIdsArray}::uuid[]) ORDER BY created_at ASC`,
    sql`SELECT * FROM lore WHERE project_id = ANY(${projectIdsArray}::uuid[]) ORDER BY created_at ASC`,
    sql`SELECT * FROM sequences WHERE project_id = ANY(${projectIdsArray}::uuid[]) ORDER BY created_at ASC`,
  ]);

  // Group related data by project_id
  const scenesByProject = new Map<string, Scene[]>();
  for (const s of scenesResult.rows) {
    const scenes = scenesByProject.get(s.project_id) || [];
    scenes.push({
      id: s.id,
      projectId: s.project_id,
      prompt: s.prompt,
      imageUrl: s.image_url,
      metadata: {
        shotType: s.shot_type,
        style: s.style,
        lighting: s.lighting,
        mood: s.mood,
        aspectRatio: s.aspect_ratio,
      },
      characterIds: s.character_ids,
      createdAt: s.created_at.toISOString(),
      updatedAt: s.updated_at.toISOString(),
    });
    scenesByProject.set(s.project_id, scenes);
  }

  const charactersByProject = new Map<string, Character[]>();
  for (const c of charactersResult.rows) {
    const characters = charactersByProject.get(c.project_id) || [];
    characters.push({
      id: c.id,
      projectId: c.project_id,
      name: c.name,
      description: c.description || '',
      imageUrl: c.image_url,
      traits: c.traits || [],
      appearances: c.appearances || [],
      createdAt: c.created_at.toISOString(),
      updatedAt: c.updated_at.toISOString(),
    });
    charactersByProject.set(c.project_id, characters);
  }

  const loreByProject = new Map<string, LoreEntry[]>();
  for (const l of loreResult.rows) {
    const lore = loreByProject.get(l.project_id) || [];
    lore.push({
      id: l.id,
      projectId: l.project_id,
      type: l.type as LoreType,
      name: l.name,
      summary: l.summary,
      description: l.description,
      tags: l.tags || [],
      associatedScenes: l.associated_scenes || [],
      imageUrl: l.image_url,
      createdAt: l.created_at.toISOString(),
      updatedAt: l.updated_at.toISOString(),
    });
    loreByProject.set(l.project_id, lore);
  }

  const sequencesByProject = new Map<string, SceneSequence[]>();
  for (const seq of sequencesResult.rows) {
    const sequences = sequencesByProject.get(seq.project_id) || [];
    sequences.push({
      id: seq.id,
      projectId: seq.project_id,
      name: seq.name,
      description: seq.description,
      shots: seq.shots || [],
      createdAt: seq.created_at.toISOString(),
      updatedAt: seq.updated_at.toISOString(),
    });
    sequencesByProject.set(seq.project_id, sequences);
  }

  // Assemble projects with their related data
  return projectsResult.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    projectType: row.project_type,
    scenes: scenesByProject.get(row.id) || [],
    characters: charactersByProject.get(row.id) || [],
    lore: loreByProject.get(row.id) || [],
    sequences: sequencesByProject.get(row.id) || [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function dbGetProjectById(id: string): Promise<Project | null> {
  if (!usePostgres) return null;

  await initializeTables();

  const projectResult = await sql`SELECT * FROM projects WHERE id = ${id}::uuid`;
  if (projectResult.rows.length === 0) return null;

  const row = projectResult.rows[0];

  // Fetch related data
  const [scenesResult, charactersResult, loreResult, sequencesResult] = await Promise.all([
    sql`SELECT * FROM scenes WHERE project_id = ${id}::uuid ORDER BY created_at ASC`,
    sql`SELECT * FROM characters WHERE project_id = ${id}::uuid ORDER BY created_at ASC`,
    sql`SELECT * FROM lore WHERE project_id = ${id}::uuid ORDER BY created_at ASC`,
    sql`SELECT * FROM sequences WHERE project_id = ${id}::uuid ORDER BY created_at ASC`,
  ]);

  const scenes: Scene[] = scenesResult.rows.map(s => ({
    id: s.id,
    projectId: s.project_id,
    prompt: s.prompt,
    imageUrl: s.image_url,
    metadata: {
      shotType: s.shot_type,
      style: s.style,
      lighting: s.lighting,
      mood: s.mood,
      aspectRatio: s.aspect_ratio,
    },
    characterIds: s.character_ids,
    createdAt: s.created_at.toISOString(),
    updatedAt: s.updated_at.toISOString(),
  }));

  const characters: Character[] = charactersResult.rows.map(c => ({
    id: c.id,
    projectId: c.project_id,
    name: c.name,
    description: c.description || '',
    imageUrl: c.image_url,
    traits: c.traits || [],
    appearances: c.appearances || [],
    createdAt: c.created_at.toISOString(),
    updatedAt: c.updated_at.toISOString(),
  }));

  const lore: LoreEntry[] = loreResult.rows.map(l => ({
    id: l.id,
    projectId: l.project_id,
    type: l.type as LoreType,
    name: l.name,
    summary: l.summary,
    description: l.description,
    tags: l.tags || [],
    associatedScenes: l.associated_scenes || [],
    imageUrl: l.image_url,
    createdAt: l.created_at.toISOString(),
    updatedAt: l.updated_at.toISOString(),
  }));

  const sequences: SceneSequence[] = sequencesResult.rows.map(seq => ({
    id: seq.id,
    projectId: seq.project_id,
    name: seq.name,
    description: seq.description,
    shots: seq.shots || [],
    createdAt: seq.created_at.toISOString(),
    updatedAt: seq.updated_at.toISOString(),
  }));

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    projectType: row.project_type,
    scenes,
    characters,
    lore,
    sequences,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function dbCreateProject(
  name: string,
  description?: string,
  userId?: string
): Promise<Project> {
  if (!usePostgres) {
    throw new Error('Database not available');
  }

  await initializeTables();

  const result = await sql`
    INSERT INTO projects (name, description, user_id)
    VALUES (${name}, ${description || null}, ${userId ? userId : null}::uuid)
    RETURNING *
  `;

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    scenes: [],
    characters: [],
    lore: [],
    sequences: [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function dbUpdateProject(
  id: string,
  updates: Partial<Pick<Project, 'name' | 'description' | 'projectType'>>
): Promise<Project | null> {
  if (!usePostgres) return null;

  await initializeTables();

  await sql`
    UPDATE projects SET
      name = COALESCE(${updates.name || null}, name),
      description = COALESCE(${updates.description || null}, description),
      project_type = COALESCE(${updates.projectType || null}, project_type),
      updated_at = NOW()
    WHERE id = ${id}::uuid
  `;

  return dbGetProjectById(id);
}

export async function dbDeleteProject(id: string): Promise<boolean> {
  if (!usePostgres) return false;

  await initializeTables();

  const result = await sql`DELETE FROM projects WHERE id = ${id}::uuid`;
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
  if (!usePostgres) return null;

  await initializeTables();

  const result = await sql`
    INSERT INTO scenes (project_id, prompt, image_url, shot_type, style, lighting, mood, aspect_ratio)
    VALUES (
      ${projectId}::uuid,
      ${prompt},
      ${imageUrl},
      ${metadata?.shotType || null},
      ${metadata?.style || null},
      ${metadata?.lighting || null},
      ${metadata?.mood || null},
      ${metadata?.aspectRatio || null}
    )
    RETURNING *
  `;

  // Update project's updated_at
  await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}::uuid`;

  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    prompt: row.prompt,
    imageUrl: row.image_url,
    metadata: {
      shotType: row.shot_type,
      style: row.style,
      lighting: row.lighting,
      mood: row.mood,
      aspectRatio: row.aspect_ratio,
    },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function dbGetSceneById(projectId: string, sceneId: string): Promise<Scene | null> {
  if (!usePostgres) return null;

  await initializeTables();

  const result = await sql`
    SELECT * FROM scenes WHERE id = ${sceneId}::uuid AND project_id = ${projectId}::uuid
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    prompt: row.prompt,
    imageUrl: row.image_url,
    metadata: {
      shotType: row.shot_type,
      style: row.style,
      lighting: row.lighting,
      mood: row.mood,
      aspectRatio: row.aspect_ratio,
    },
    characterIds: row.character_ids,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function dbUpdateScene(
  projectId: string,
  sceneId: string,
  updates: Partial<Pick<Scene, 'prompt' | 'imageUrl' | 'metadata'>>
): Promise<Scene | null> {
  if (!usePostgres) return null;

  await initializeTables();

  await sql`
    UPDATE scenes SET
      prompt = COALESCE(${updates.prompt || null}, prompt),
      image_url = COALESCE(${updates.imageUrl || null}, image_url),
      shot_type = COALESCE(${updates.metadata?.shotType || null}, shot_type),
      style = COALESCE(${updates.metadata?.style || null}, style),
      lighting = COALESCE(${updates.metadata?.lighting || null}, lighting),
      mood = COALESCE(${updates.metadata?.mood || null}, mood),
      aspect_ratio = COALESCE(${updates.metadata?.aspectRatio || null}, aspect_ratio),
      updated_at = NOW()
    WHERE id = ${sceneId}::uuid AND project_id = ${projectId}::uuid
  `;

  await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}::uuid`;

  return dbGetSceneById(projectId, sceneId);
}

export async function dbDeleteScene(projectId: string, sceneId: string): Promise<boolean> {
  if (!usePostgres) return false;

  await initializeTables();

  const result = await sql`
    DELETE FROM scenes WHERE id = ${sceneId}::uuid AND project_id = ${projectId}::uuid
  `;

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}::uuid`;
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
  if (!usePostgres) return null;

  await initializeTables();

  const traitsArray = toPostgresArray(traits);
  const result = await sql`
    INSERT INTO characters (project_id, name, description, traits, image_url)
    VALUES (${projectId}::uuid, ${name}, ${description}, ${traitsArray}::text[], ${imageUrl || null})
    RETURNING *
  `;

  await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}::uuid`;

  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description || '',
    imageUrl: row.image_url,
    traits: row.traits || [],
    appearances: row.appearances || [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function dbGetCharacterById(projectId: string, characterId: string): Promise<Character | null> {
  if (!usePostgres) return null;

  await initializeTables();

  const result = await sql`
    SELECT * FROM characters WHERE id = ${characterId}::uuid AND project_id = ${projectId}::uuid
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description || '',
    imageUrl: row.image_url,
    traits: row.traits || [],
    appearances: row.appearances || [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function dbUpdateCharacter(
  projectId: string,
  characterId: string,
  updates: Partial<Pick<Character, 'name' | 'description' | 'traits' | 'imageUrl' | 'appearances'>>
): Promise<Character | null> {
  if (!usePostgres) return null;

  await initializeTables();

  // Use properly escaped array format for traits
  const traitsValue = updates.traits !== undefined ? toPostgresArray(updates.traits) : null;
  const appearancesValue = updates.appearances !== undefined ? JSON.stringify(updates.appearances) : null;

  await sql`
    UPDATE characters SET
      name = COALESCE(${updates.name || null}, name),
      description = COALESCE(${updates.description || null}, description),
      traits = COALESCE(${traitsValue}::text[], traits),
      image_url = COALESCE(${updates.imageUrl || null}, image_url),
      appearances = COALESCE(${appearancesValue}::jsonb, appearances),
      updated_at = NOW()
    WHERE id = ${characterId}::uuid AND project_id = ${projectId}::uuid
  `;

  await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}::uuid`;

  return dbGetCharacterById(projectId, characterId);
}

export async function dbDeleteCharacter(projectId: string, characterId: string): Promise<boolean> {
  if (!usePostgres) return false;

  await initializeTables();

  const result = await sql`
    DELETE FROM characters WHERE id = ${characterId}::uuid AND project_id = ${projectId}::uuid
  `;

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}::uuid`;
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
  if (!usePostgres) return null;

  await initializeTables();

  const tagsArray = toPostgresArray(tags || []);
  const result = await sql`
    INSERT INTO lore (project_id, type, name, summary, description, tags)
    VALUES (${projectId}::uuid, ${type}, ${name}, ${summary}, ${description || null}, ${tagsArray}::text[])
    RETURNING *
  `;

  await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}::uuid`;

  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as LoreType,
    name: row.name,
    summary: row.summary,
    description: row.description,
    tags: row.tags || [],
    associatedScenes: row.associated_scenes || [],
    imageUrl: row.image_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function dbGetLoreById(projectId: string, loreId: string): Promise<LoreEntry | null> {
  if (!usePostgres) return null;

  await initializeTables();

  const result = await sql`
    SELECT * FROM lore WHERE id = ${loreId}::uuid AND project_id = ${projectId}::uuid
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as LoreType,
    name: row.name,
    summary: row.summary,
    description: row.description,
    tags: row.tags || [],
    associatedScenes: row.associated_scenes || [],
    imageUrl: row.image_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function dbUpdateLore(
  projectId: string,
  loreId: string,
  updates: Partial<Pick<LoreEntry, 'name' | 'summary' | 'description' | 'tags' | 'associatedScenes' | 'imageUrl'>>
): Promise<LoreEntry | null> {
  if (!usePostgres) return null;

  await initializeTables();

  // Use properly escaped array format for tags
  const tagsValue = updates.tags !== undefined ? toPostgresArray(updates.tags) : null;
  // Use UUID-validated array format for associatedScenes to prevent injection
  const scenesValue = updates.associatedScenes !== undefined
    ? toPostgresUUIDArray(updates.associatedScenes)
    : null;

  await sql`
    UPDATE lore SET
      name = COALESCE(${updates.name || null}, name),
      summary = COALESCE(${updates.summary || null}, summary),
      description = COALESCE(${updates.description || null}, description),
      tags = COALESCE(${tagsValue}::text[], tags),
      associated_scenes = COALESCE(${scenesValue}::uuid[], associated_scenes),
      image_url = COALESCE(${updates.imageUrl || null}, image_url),
      updated_at = NOW()
    WHERE id = ${loreId}::uuid AND project_id = ${projectId}::uuid
  `;

  await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}::uuid`;

  return dbGetLoreById(projectId, loreId);
}

export async function dbDeleteLore(projectId: string, loreId: string): Promise<boolean> {
  if (!usePostgres) return false;

  await initializeTables();

  const result = await sql`
    DELETE FROM lore WHERE id = ${loreId}::uuid AND project_id = ${projectId}::uuid
  `;

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}::uuid`;
  }

  return deleted;
}

export async function dbGetProjectLore(projectId: string, type?: LoreType): Promise<LoreEntry[]> {
  if (!usePostgres) return [];

  await initializeTables();

  let result;
  if (type) {
    result = await sql`
      SELECT * FROM lore WHERE project_id = ${projectId}::uuid AND type = ${type}
      ORDER BY created_at ASC
    `;
  } else {
    result = await sql`
      SELECT * FROM lore WHERE project_id = ${projectId}::uuid ORDER BY created_at ASC
    `;
  }

  return result.rows.map(row => ({
    id: row.id,
    projectId: row.project_id,
    type: row.type as LoreType,
    name: row.name,
    summary: row.summary,
    description: row.description,
    tags: row.tags || [],
    associatedScenes: row.associated_scenes || [],
    imageUrl: row.image_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
}

// ============================================================================
// Sequence operations
// ============================================================================

export async function dbAddSequence(
  projectId: string,
  name: string,
  description?: string
): Promise<SceneSequence | null> {
  if (!usePostgres) return null;

  await initializeTables();

  const result = await sql`
    INSERT INTO sequences (project_id, name, description)
    VALUES (${projectId}::uuid, ${name}, ${description || null})
    RETURNING *
  `;

  await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}::uuid`;

  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    shots: row.shots || [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function dbUpdateSequence(
  projectId: string,
  sequenceId: string,
  updates: Partial<Pick<SceneSequence, 'name' | 'description' | 'shots'>>
): Promise<SceneSequence | null> {
  if (!usePostgres) return null;

  await initializeTables();

  await sql`
    UPDATE sequences SET
      name = COALESCE(${updates.name || null}, name),
      description = COALESCE(${updates.description || null}, description),
      shots = COALESCE(${updates.shots ? JSON.stringify(updates.shots) : null}::jsonb, shots),
      updated_at = NOW()
    WHERE id = ${sequenceId}::uuid AND project_id = ${projectId}::uuid
  `;

  await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}::uuid`;

  const result = await sql`
    SELECT * FROM sequences WHERE id = ${sequenceId}::uuid AND project_id = ${projectId}::uuid
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    shots: row.shots || [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function dbDeleteSequence(projectId: string, sequenceId: string): Promise<boolean> {
  if (!usePostgres) return false;

  await initializeTables();

  const result = await sql`
    DELETE FROM sequences WHERE id = ${sequenceId}::uuid AND project_id = ${projectId}::uuid
  `;

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}::uuid`;
  }

  return deleted;
}

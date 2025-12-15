import { Project, Scene, Character, LoreEntry, SceneSequence, ShotBlock, LoreType } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import {
  isPostgresAvailable,
  dbGetAllProjects,
  dbGetProjectById,
  dbCreateProject,
  dbUpdateProject,
  dbDeleteProject,
  dbAddScene,
  dbGetSceneById,
  dbUpdateScene,
  dbDeleteScene,
  dbAddCharacter,
  dbGetCharacterById,
  dbUpdateCharacter,
  dbDeleteCharacter,
  dbAddLore,
  dbGetLoreById,
  dbUpdateLore,
  dbDeleteLore,
  dbGetProjectLore,
  dbAddSequence,
  dbUpdateSequence,
  dbDeleteSequence,
} from './db';

// Check if we should use Postgres
const usePostgres = isPostgresAvailable();

// IMPORTANT: /tmp on Vercel is EPHEMERAL - data is lost on cold starts!
// This file-based storage is only used for local development when POSTGRES_URL is not set.
const isVercel = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production';
const DATA_DIR = isVercel
  ? '/tmp/halcyon-data'
  : path.join(process.cwd(), 'src', 'data');
const DATA_FILE = path.join(DATA_DIR, 'projects.json');

// Structured logging helper for internal use only (server-side)
function logStorageEvent(level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    service: 'halcyon-storage',
    level,
    message,
    ...(context && { context: sanitizeLogContext(context) }),
  };

  // In production, use structured JSON logging; in dev, use readable format
  if (isProduction) {
    console[level](JSON.stringify(logEntry));
  } else {
    console[level](`[${logEntry.service}] ${message}`, context ? sanitizeLogContext(context) : '');
  }
}

// Sanitize log context to prevent sensitive data leakage
function sanitizeLogContext(context: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...context };
  // Remove or mask potentially sensitive fields
  if (sanitized.error instanceof Error) {
    const errorDetails: Record<string, unknown> = {
      name: sanitized.error.name,
      message: sanitized.error.message,
    };

    // Include useful NodeJS error properties for debugging file system issues
    const nodeError = sanitized.error as NodeJS.ErrnoException;
    if (nodeError.code !== undefined) errorDetails.code = nodeError.code;
    if (nodeError.syscall !== undefined) errorDetails.syscall = nodeError.syscall;
    if (nodeError.errno !== undefined) errorDetails.errno = nodeError.errno;

    // Don't include stack traces in production logs
    if (!isProduction) {
      errorDetails.stack = sanitized.error.stack;
    }

    sanitized.error = errorDetails;
  }
  return sanitized;
}

// Log storage mode on startup
if (usePostgres) {
  logStorageEvent('info', 'Using Vercel Postgres for persistent storage');
} else if (isVercel) {
  logStorageEvent('warn', 'POSTGRES_URL not configured. Using ephemeral /tmp storage. Data will not persist between cold starts.', {
    recommendation: 'Configure POSTGRES_URL environment variable for persistent storage',
  });
} else {
  logStorageEvent('info', 'Using local file storage for development');
}

// ============================================================================
// File-based storage for local development (fallback when Postgres unavailable)
// ============================================================================

// In-memory storage (with optional file persistence when possible)
let projects: Project[] = [];
let fileSystemAvailable = true;
let lastFileReadTime = 0;
const FILE_CACHE_TTL_MS = 100; // Re-read file if older than 100ms (for serverless consistency)

function ensureDataDir(): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    return true;
  } catch (error) {
    logStorageEvent('warn', 'Data directory creation failed, using in-memory storage', {
      dataDir: DATA_DIR,
      error,
    });
    fileSystemAvailable = false;
    return false;
  }
}

// Validate that parsed data is an array of projects with required fields
function validateProjectsData(data: unknown): data is Project[] {
  if (!Array.isArray(data)) {
    return false;
  }
  // Validate each project has required fields matching Project interface
  return data.every(item =>
    typeof item === 'object' &&
    item !== null &&
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    Array.isArray(item.scenes) &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string' &&
    // userId is optional but must be string if present
    (item.userId === undefined || typeof item.userId === 'string')
  );
}

function loadFromFile(): void {
  const now = Date.now();

  // Use cached data if very recent and we have data
  if (now - lastFileReadTime < FILE_CACHE_TTL_MS && projects.length > 0) {
    return;
  }

  if (!ensureDataDir() || !fs.existsSync(DATA_FILE)) {
    lastFileReadTime = now;
    return;
  }

  let fileContent: string;

  // Step 1: Read file
  try {
    fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
  } catch (error) {
    logStorageEvent('error', 'Failed to read projects file', {
      filePath: DATA_FILE,
      errorType: 'read',
      error,
    });
    lastFileReadTime = now;
    return;
  }

  // Step 2: Parse JSON
  let parsedData: unknown;
  try {
    parsedData = JSON.parse(fileContent);
  } catch (error) {
    logStorageEvent('error', 'Failed to parse projects JSON - file may be corrupt', {
      filePath: DATA_FILE,
      errorType: 'parse',
      contentLength: fileContent.length,
      error,
    });
    lastFileReadTime = now;
    return;
  }

  // Step 3: Validate schema
  if (!validateProjectsData(parsedData)) {
    logStorageEvent('error', 'Projects data failed schema validation', {
      filePath: DATA_FILE,
      errorType: 'validation',
      dataType: typeof parsedData,
      isArray: Array.isArray(parsedData),
    });
    lastFileReadTime = now;
    return;
  }

  // Success: update projects and timestamp
  projects = parsedData;
  lastFileReadTime = now;
}

function saveToFile(): void {
  if (!fileSystemAvailable) return;

  try {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2));
  } catch (error) {
    logStorageEvent('error', 'Failed to save projects file, using in-memory only', {
      filePath: DATA_FILE,
      projectCount: projects.length,
      error,
    });
    fileSystemAvailable = false;
  }
}

// ============================================================================
// Project CRUD operations (with Postgres support)
// ============================================================================

export function getAllProjects(userId?: string): Project[] {
  if (usePostgres) {
    // Note: This is called from server-side code (getServerSideProps)
    // We can't use async here directly, so we'll handle this in the API routes
    // For now, return empty and let the API handle it
    return [];
  }

  loadFromFile();
  let filteredProjects = userId ? projects.filter(p => p.userId === userId) : projects;
  return [...filteredProjects].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getAllProjectsAsync(userId?: string): Promise<Project[]> {
  if (usePostgres) {
    return dbGetAllProjects(userId);
  }

  loadFromFile();
  let filteredProjects = userId ? projects.filter(p => p.userId === userId) : projects;
  return [...filteredProjects].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getProjectById(id: string): Project | null {
  if (usePostgres) {
    // This sync version returns null when using Postgres - use async version
    return null;
  }

  loadFromFile();
  return projects.find(p => p.id === id) || null;
}

export async function getProjectByIdAsync(id: string): Promise<Project | null> {
  if (usePostgres) {
    return dbGetProjectById(id);
  }

  loadFromFile();
  return projects.find(p => p.id === id) || null;
}

export function createProject(name: string, description?: string, userId?: string): Project {
  if (usePostgres) {
    // Use createProjectAsync for Postgres
    throw new Error('Use createProjectAsync for Postgres storage');
  }

  loadFromFile();

  const now = new Date().toISOString();
  const project: Project = {
    id: uuidv4(),
    userId,
    name,
    description,
    scenes: [],
    characters: [],
    lore: [],
    sequences: [],
    createdAt: now,
    updatedAt: now,
  };

  projects.push(project);
  saveToFile();
  return project;
}

export async function createProjectAsync(name: string, description?: string, userId?: string): Promise<Project> {
  if (usePostgres) {
    return dbCreateProject(name, description, userId);
  }

  loadFromFile();

  const now = new Date().toISOString();
  const project: Project = {
    id: uuidv4(),
    userId,
    name,
    description,
    scenes: [],
    characters: [],
    lore: [],
    sequences: [],
    createdAt: now,
    updatedAt: now,
  };

  projects.push(project);
  saveToFile();
  return project;
}

export function updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'characters' | 'lore' | 'sequences' | 'projectType'>>): Project | null {
  if (usePostgres) {
    return null; // Use updateProjectAsync
  }

  loadFromFile();

  const index = projects.findIndex(p => p.id === id);
  if (index === -1) return null;

  projects[index] = {
    ...projects[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveToFile();
  return projects[index];
}

export async function updateProjectAsync(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'projectType'>>): Promise<Project | null> {
  if (usePostgres) {
    return dbUpdateProject(id, updates);
  }

  loadFromFile();

  const index = projects.findIndex(p => p.id === id);
  if (index === -1) return null;

  projects[index] = {
    ...projects[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveToFile();
  return projects[index];
}

export function deleteProject(id: string): boolean {
  if (usePostgres) {
    return false; // Use deleteProjectAsync
  }

  loadFromFile();

  const index = projects.findIndex(p => p.id === id);
  if (index === -1) return false;

  projects.splice(index, 1);
  saveToFile();
  return true;
}

export async function deleteProjectAsync(id: string): Promise<boolean> {
  if (usePostgres) {
    return dbDeleteProject(id);
  }

  loadFromFile();

  const index = projects.findIndex(p => p.id === id);
  if (index === -1) return false;

  projects.splice(index, 1);
  saveToFile();
  return true;
}

// ============================================================================
// Scene CRUD operations
// ============================================================================

export function addSceneToProject(
  projectId: string,
  prompt: string,
  imageUrl: string | null,
  metadata?: Scene['metadata']
): Scene | null {
  if (usePostgres) {
    return null; // Use addSceneToProjectAsync
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project) return null;

  const now = new Date().toISOString();
  const scene: Scene = {
    id: uuidv4(),
    projectId,
    prompt,
    imageUrl,
    metadata,
    createdAt: now,
    updatedAt: now,
  };

  project.scenes.push(scene);
  project.updatedAt = now;
  saveToFile();

  return scene;
}

export async function addSceneToProjectAsync(
  projectId: string,
  prompt: string,
  imageUrl: string | null,
  metadata?: Scene['metadata'],
  characterIds?: string[]
): Promise<Scene | null> {
  if (usePostgres) {
    return dbAddScene(projectId, prompt, imageUrl, metadata, characterIds);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project) return null;

  const now = new Date().toISOString();
  const scene: Scene = {
    id: uuidv4(),
    projectId,
    prompt,
    imageUrl,
    metadata,
    characterIds,
    createdAt: now,
    updatedAt: now,
  };

  project.scenes.push(scene);
  project.updatedAt = now;
  saveToFile();

  return scene;
}

export function getSceneById(projectId: string, sceneId: string): Scene | null {
  if (usePostgres) {
    return null; // Use getSceneByIdAsync
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project) return null;

  return project.scenes.find(s => s.id === sceneId) || null;
}

export async function getSceneByIdAsync(projectId: string, sceneId: string): Promise<Scene | null> {
  if (usePostgres) {
    return dbGetSceneById(projectId, sceneId);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project) return null;

  return project.scenes.find(s => s.id === sceneId) || null;
}

export function updateScene(
  projectId: string,
  sceneId: string,
  updates: Partial<Pick<Scene, 'prompt' | 'imageUrl' | 'metadata' | 'notes'>>
): Scene | null {
  if (usePostgres) {
    return null; // Use updateSceneAsync
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project) return null;

  const sceneIndex = project.scenes.findIndex(s => s.id === sceneId);
  if (sceneIndex === -1) return null;

  const now = new Date().toISOString();
  project.scenes[sceneIndex] = {
    ...project.scenes[sceneIndex],
    ...updates,
    updatedAt: now,
  };
  project.updatedAt = now;

  saveToFile();
  return project.scenes[sceneIndex];
}

export async function updateSceneAsync(
  projectId: string,
  sceneId: string,
  updates: Partial<Pick<Scene, 'prompt' | 'imageUrl' | 'metadata' | 'notes'>>
): Promise<Scene | null> {
  if (usePostgres) {
    return dbUpdateScene(projectId, sceneId, updates);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project) return null;

  const sceneIndex = project.scenes.findIndex(s => s.id === sceneId);
  if (sceneIndex === -1) return null;

  const now = new Date().toISOString();
  project.scenes[sceneIndex] = {
    ...project.scenes[sceneIndex],
    ...updates,
    updatedAt: now,
  };
  project.updatedAt = now;

  saveToFile();
  return project.scenes[sceneIndex];
}

export function deleteScene(projectId: string, sceneId: string): boolean {
  if (usePostgres) {
    return false; // Use deleteSceneAsync
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project) return false;

  const sceneIndex = project.scenes.findIndex(s => s.id === sceneId);
  if (sceneIndex === -1) return false;

  project.scenes.splice(sceneIndex, 1);
  project.updatedAt = new Date().toISOString();
  saveToFile();

  return true;
}

export async function deleteSceneAsync(projectId: string, sceneId: string): Promise<boolean> {
  if (usePostgres) {
    return dbDeleteScene(projectId, sceneId);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project) return false;

  const sceneIndex = project.scenes.findIndex(s => s.id === sceneId);
  if (sceneIndex === -1) return false;

  project.scenes.splice(sceneIndex, 1);
  project.updatedAt = new Date().toISOString();
  saveToFile();

  return true;
}

// ============================================================================
// Utility functions
// ============================================================================

export function getProjectSceneCount(projectId: string): number {
  const project = getProjectById(projectId);
  return project?.scenes.length || 0;
}

export function clearAllData(): void {
  projects = [];
  lastFileReadTime = 0;
  saveToFile();
}

// ============================================================================
// Lore CRUD operations
// ============================================================================

export function addLoreToProject(
  projectId: string,
  type: LoreType,
  name: string,
  summary: string,
  description?: string,
  tags?: string[]
): LoreEntry | null {
  if (usePostgres) {
    return null; // Use addLoreToProjectAsync
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project) return null;

  if (!project.lore) {
    project.lore = [];
  }

  const now = new Date().toISOString();
  const loreEntry: LoreEntry = {
    id: uuidv4(),
    projectId,
    type,
    name,
    summary,
    description,
    tags: tags || [],
    associatedScenes: [],
    createdAt: now,
    updatedAt: now,
  };

  project.lore.push(loreEntry);
  project.updatedAt = now;
  saveToFile();

  return loreEntry;
}

export async function addLoreToProjectAsync(
  projectId: string,
  type: LoreType,
  name: string,
  summary: string,
  description?: string,
  tags?: string[]
): Promise<LoreEntry | null> {
  if (usePostgres) {
    return dbAddLore(projectId, type, name, summary, description, tags);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project) return null;

  if (!project.lore) {
    project.lore = [];
  }

  const now = new Date().toISOString();
  const loreEntry: LoreEntry = {
    id: uuidv4(),
    projectId,
    type,
    name,
    summary,
    description,
    tags: tags || [],
    associatedScenes: [],
    createdAt: now,
    updatedAt: now,
  };

  project.lore.push(loreEntry);
  project.updatedAt = now;
  saveToFile();

  return loreEntry;
}

export function getLoreById(projectId: string, loreId: string): LoreEntry | null {
  if (usePostgres) {
    return null; // Use getLoreByIdAsync
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.lore) return null;

  return project.lore.find(l => l.id === loreId) || null;
}

export async function getLoreByIdAsync(projectId: string, loreId: string): Promise<LoreEntry | null> {
  if (usePostgres) {
    return dbGetLoreById(projectId, loreId);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.lore) return null;

  return project.lore.find(l => l.id === loreId) || null;
}

export function updateLore(
  projectId: string,
  loreId: string,
  updates: Partial<Pick<LoreEntry, 'name' | 'summary' | 'description' | 'tags' | 'associatedScenes' | 'imageUrl'>>
): LoreEntry | null {
  if (usePostgres) {
    return null; // Use updateLoreAsync
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.lore) return null;

  const loreIndex = project.lore.findIndex(l => l.id === loreId);
  if (loreIndex === -1) return null;

  const now = new Date().toISOString();
  project.lore[loreIndex] = {
    ...project.lore[loreIndex],
    ...updates,
    updatedAt: now,
  };
  project.updatedAt = now;

  saveToFile();
  return project.lore[loreIndex];
}

export async function updateLoreAsync(
  projectId: string,
  loreId: string,
  updates: Partial<Pick<LoreEntry, 'name' | 'summary' | 'description' | 'tags' | 'associatedScenes' | 'imageUrl'>>
): Promise<LoreEntry | null> {
  if (usePostgres) {
    return dbUpdateLore(projectId, loreId, updates);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.lore) return null;

  const loreIndex = project.lore.findIndex(l => l.id === loreId);
  if (loreIndex === -1) return null;

  const now = new Date().toISOString();
  project.lore[loreIndex] = {
    ...project.lore[loreIndex],
    ...updates,
    updatedAt: now,
  };
  project.updatedAt = now;

  saveToFile();
  return project.lore[loreIndex];
}

export function deleteLore(projectId: string, loreId: string): boolean {
  if (usePostgres) {
    return false; // Use deleteLoreAsync
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.lore) return false;

  const loreIndex = project.lore.findIndex(l => l.id === loreId);
  if (loreIndex === -1) return false;

  project.lore.splice(loreIndex, 1);
  project.updatedAt = new Date().toISOString();
  saveToFile();

  return true;
}

export async function deleteLoreAsync(projectId: string, loreId: string): Promise<boolean> {
  if (usePostgres) {
    return dbDeleteLore(projectId, loreId);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.lore) return false;

  const loreIndex = project.lore.findIndex(l => l.id === loreId);
  if (loreIndex === -1) return false;

  project.lore.splice(loreIndex, 1);
  project.updatedAt = new Date().toISOString();
  saveToFile();

  return true;
}

export function getProjectLore(projectId: string, type?: LoreType): LoreEntry[] {
  if (usePostgres) {
    return []; // Use getProjectLoreAsync
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.lore) return [];

  if (type) {
    return project.lore.filter(l => l.type === type);
  }
  return project.lore;
}

export async function getProjectLoreAsync(projectId: string, type?: LoreType): Promise<LoreEntry[]> {
  if (usePostgres) {
    return dbGetProjectLore(projectId, type);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.lore) return [];

  if (type) {
    return project.lore.filter(l => l.type === type);
  }
  return project.lore;
}

// ============================================================================
// Scene Sequence CRUD operations
// ============================================================================

export function addSequenceToProject(
  projectId: string,
  name: string,
  description?: string
): SceneSequence | null {
  if (usePostgres) {
    return null; // Use addSequenceToProjectAsync
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project) return null;

  if (!project.sequences) {
    project.sequences = [];
  }

  const now = new Date().toISOString();
  const sequence: SceneSequence = {
    id: uuidv4(),
    projectId,
    name,
    description,
    shots: [],
    createdAt: now,
    updatedAt: now,
  };

  project.sequences.push(sequence);
  project.updatedAt = now;
  saveToFile();

  return sequence;
}

export async function addSequenceToProjectAsync(
  projectId: string,
  name: string,
  description?: string,
  shots?: ShotBlock[]
): Promise<SceneSequence | null> {
  if (usePostgres) {
    const sequence = await dbAddSequence(projectId, name, description);
    if (sequence && shots && shots.length > 0) {
      return dbUpdateSequence(projectId, sequence.id, { shots });
    }
    return sequence;
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project) return null;

  if (!project.sequences) {
    project.sequences = [];
  }

  const now = new Date().toISOString();
  const sequence: SceneSequence = {
    id: uuidv4(),
    projectId,
    name,
    description,
    shots: shots || [],
    createdAt: now,
    updatedAt: now,
  };

  project.sequences.push(sequence);
  project.updatedAt = now;
  saveToFile();

  return sequence;
}

export async function getProjectSequencesAsync(projectId: string): Promise<SceneSequence[]> {
  if (usePostgres) {
    const project = await dbGetProjectById(projectId);
    return project?.sequences || [];
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  return project?.sequences || [];
}

export function getSequenceById(projectId: string, sequenceId: string): SceneSequence | null {
  if (usePostgres) {
    return null; // Use database async version
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.sequences) return null;

  return project.sequences.find(s => s.id === sequenceId) || null;
}

export function updateSequence(
  projectId: string,
  sequenceId: string,
  updates: Partial<Pick<SceneSequence, 'name' | 'description' | 'shots'>>
): SceneSequence | null {
  if (usePostgres) {
    return null; // Use updateSequenceAsync
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.sequences) return null;

  const seqIndex = project.sequences.findIndex(s => s.id === sequenceId);
  if (seqIndex === -1) return null;

  const now = new Date().toISOString();
  project.sequences[seqIndex] = {
    ...project.sequences[seqIndex],
    ...updates,
    updatedAt: now,
  };
  project.updatedAt = now;

  saveToFile();
  return project.sequences[seqIndex];
}

export async function updateSequenceAsync(
  projectId: string,
  sequenceId: string,
  updates: Partial<Pick<SceneSequence, 'name' | 'description' | 'shots'>>
): Promise<SceneSequence | null> {
  if (usePostgres) {
    return dbUpdateSequence(projectId, sequenceId, updates);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.sequences) return null;

  const seqIndex = project.sequences.findIndex(s => s.id === sequenceId);
  if (seqIndex === -1) return null;

  const now = new Date().toISOString();
  project.sequences[seqIndex] = {
    ...project.sequences[seqIndex],
    ...updates,
    updatedAt: now,
  };
  project.updatedAt = now;

  saveToFile();
  return project.sequences[seqIndex];
}

export function deleteSequence(projectId: string, sequenceId: string): boolean {
  if (usePostgres) {
    return false; // Use deleteSequenceAsync
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.sequences) return false;

  const seqIndex = project.sequences.findIndex(s => s.id === sequenceId);
  if (seqIndex === -1) return false;

  project.sequences.splice(seqIndex, 1);
  project.updatedAt = new Date().toISOString();
  saveToFile();

  return true;
}

export async function deleteSequenceAsync(projectId: string, sequenceId: string): Promise<boolean> {
  if (usePostgres) {
    return dbDeleteSequence(projectId, sequenceId);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.sequences) return false;

  const seqIndex = project.sequences.findIndex(s => s.id === sequenceId);
  if (seqIndex === -1) return false;

  project.sequences.splice(seqIndex, 1);
  project.updatedAt = new Date().toISOString();
  saveToFile();

  return true;
}

// ============================================================================
// Character CRUD operations
// ============================================================================

export async function addCharacterToProjectAsync(
  projectId: string,
  name: string,
  description: string,
  traits: string[] = [],
  imageUrl?: string
): Promise<Character | null> {
  if (usePostgres) {
    return dbAddCharacter(projectId, name, description, traits, imageUrl);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project) return null;

  if (!project.characters) {
    project.characters = [];
  }

  const now = new Date().toISOString();
  const character: Character = {
    id: uuidv4(),
    projectId,
    name,
    description,
    imageUrl,
    traits,
    appearances: [],
    createdAt: now,
    updatedAt: now,
  };

  project.characters.push(character);
  project.updatedAt = now;
  saveToFile();

  return character;
}

export async function getCharacterByIdAsync(projectId: string, characterId: string): Promise<Character | null> {
  if (usePostgres) {
    return dbGetCharacterById(projectId, characterId);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.characters) return null;

  return project.characters.find(c => c.id === characterId) || null;
}

export async function updateCharacterAsync(
  projectId: string,
  characterId: string,
  updates: Partial<Pick<Character, 'name' | 'description' | 'traits' | 'imageUrl' | 'appearances'>>
): Promise<Character | null> {
  if (usePostgres) {
    return dbUpdateCharacter(projectId, characterId, updates);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.characters) return null;

  const charIndex = project.characters.findIndex(c => c.id === characterId);
  if (charIndex === -1) return null;

  const now = new Date().toISOString();
  project.characters[charIndex] = {
    ...project.characters[charIndex],
    ...updates,
    updatedAt: now,
  };
  project.updatedAt = now;

  saveToFile();
  return project.characters[charIndex];
}

export async function deleteCharacterAsync(projectId: string, characterId: string): Promise<boolean> {
  if (usePostgres) {
    return dbDeleteCharacter(projectId, characterId);
  }

  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.characters) return false;

  const charIndex = project.characters.findIndex(c => c.id === characterId);
  if (charIndex === -1) return false;

  project.characters.splice(charIndex, 1);
  project.updatedAt = new Date().toISOString();
  saveToFile();

  return true;
}

// Export helper to check if using Postgres
export function isUsingPostgres(): boolean {
  return usePostgres;
}

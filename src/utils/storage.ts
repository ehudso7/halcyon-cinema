import { Project, Scene, Character, LoreEntry, SceneSequence, LoreType } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// IMPORTANT: /tmp on Vercel is EPHEMERAL - data is lost on cold starts!
// This is a temporary solution for demo/development purposes.
// For production, migrate to a persistent database (e.g., Vercel Postgres, PlanetScale, Supabase).
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
    sanitized.error = {
      name: sanitized.error.name,
      message: sanitized.error.message,
      // Don't include stack traces in production logs
      ...(isProduction ? {} : { stack: sanitized.error.stack }),
    };
  }
  return sanitized;
}

// Log warning on Vercel about ephemeral storage (once on startup)
if (isVercel) {
  logStorageEvent('warn', 'Using ephemeral /tmp storage. Data will not persist between cold starts.', {
    recommendation: 'Migrate to Vercel Postgres or similar database for production',
  });
}

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
  // Validate each project has required fields
  return data.every(item =>
    typeof item === 'object' &&
    item !== null &&
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    Array.isArray(item.scenes)
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
    // Keep existing in-memory data rather than corrupting it
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
    // Keep existing in-memory data rather than corrupting it
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

// Project CRUD operations
export function getAllProjects(): Project[] {
  loadFromFile();
  return [...projects].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getProjectById(id: string): Project | null {
  loadFromFile();
  return projects.find(p => p.id === id) || null;
}

export function createProject(name: string, description?: string, userId?: string): Project {
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
  loadFromFile();

  const index = projects.findIndex(p => p.id === id);
  if (index === -1) return false;

  projects.splice(index, 1);
  saveToFile();
  return true;
}

// Scene CRUD operations
export function addSceneToProject(
  projectId: string,
  prompt: string,
  imageUrl: string | null,
  metadata?: Scene['metadata']
): Scene | null {
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

export function getSceneById(projectId: string, sceneId: string): Scene | null {
  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project) return null;

  return project.scenes.find(s => s.id === sceneId) || null;
}

export function updateScene(
  projectId: string,
  sceneId: string,
  updates: Partial<Pick<Scene, 'prompt' | 'imageUrl' | 'metadata'>>
): Scene | null {
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

// Utility functions
export function getProjectSceneCount(projectId: string): number {
  const project = getProjectById(projectId);
  return project?.scenes.length || 0;
}

export function clearAllData(): void {
  projects = [];
  lastFileReadTime = 0;
  saveToFile();
}

// Lore CRUD operations
export function addLoreToProject(
  projectId: string,
  type: LoreType,
  name: string,
  summary: string,
  description?: string,
  tags?: string[]
): LoreEntry | null {
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
  loadFromFile();

  const project = projects.find(p => p.id === projectId);
  if (!project || !project.lore) return [];

  if (type) {
    return project.lore.filter(l => l.type === type);
  }
  return project.lore;
}

// Scene Sequence CRUD operations
export function addSequenceToProject(
  projectId: string,
  name: string,
  description?: string
): SceneSequence | null {
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

export function getSequenceById(projectId: string, sequenceId: string): SceneSequence | null {
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

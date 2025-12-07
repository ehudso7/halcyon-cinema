import { Project, Scene } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'projects.json');

// In-memory storage for development (with optional file persistence)
let projects: Project[] = [];
let initialized = false;

function ensureDataDir(): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadFromFile(): void {
  if (initialized) return;

  try {
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      projects = JSON.parse(data);
    }
  } catch {
    projects = [];
  }
  initialized = true;
}

function saveToFile(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2));
  } catch (error) {
    console.error('Failed to save projects:', error);
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

export function createProject(name: string, description?: string): Project {
  loadFromFile();

  const now = new Date().toISOString();
  const project: Project = {
    id: uuidv4(),
    name,
    description,
    scenes: [],
    createdAt: now,
    updatedAt: now,
  };

  projects.push(project);
  saveToFile();
  return project;
}

export function updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description'>>): Project | null {
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
  saveToFile();
}

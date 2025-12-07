import { User } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// IMPORTANT: /tmp on Vercel is EPHEMERAL - data is lost on cold starts!
// This is a temporary solution for demo/development purposes.
// For production, migrate to a persistent database (e.g., Vercel Postgres, PlanetScale, Supabase).
const isVercel = process.env.VERCEL === '1';
const DATA_DIR = isVercel
  ? '/tmp/halcyon-data'
  : path.join(process.cwd(), 'src', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

let users: User[] = [];
let initialized = false;
let fileSystemAvailable = true;

function ensureDataDir(): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    return true;
  } catch (error) {
    console.warn('Data directory not available, using in-memory storage only:', error);
    fileSystemAvailable = false;
    return false;
  }
}

function loadFromFile(): void {
  if (initialized) return;

  try {
    if (ensureDataDir() && fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      users = JSON.parse(data);
    }
  } catch (error) {
    console.warn('Failed to load users from file, using in-memory storage:', error);
    users = [];
  }
  initialized = true;
}

function saveToFile(): void {
  if (!fileSystemAvailable) return;

  try {
    ensureDataDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.warn('Failed to save users (using in-memory only):', error);
    fileSystemAvailable = false;
  }
}

export async function createUser(email: string, password: string, name: string): Promise<User> {
  loadFromFile();

  const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    throw new Error('User already exists');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();

  const user: User = {
    id: uuidv4(),
    email: email.toLowerCase(),
    name,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  users.push(user);
  saveToFile();

  // Return user without password hash
  const { passwordHash: _, ...safeUser } = user;
  return safeUser as User;
}

export async function validateUser(email: string, password: string): Promise<User | null> {
  loadFromFile();

  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.passwordHash) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  // Return user without password hash
  const { passwordHash: _, ...safeUser } = user;
  return safeUser as User;
}

export function getUserById(id: string): User | null {
  loadFromFile();
  const user = users.find(u => u.id === id);
  if (!user) return null;

  const { passwordHash: _, ...safeUser } = user;
  return safeUser as User;
}

export function getUserByEmail(email: string): User | null {
  loadFromFile();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return null;

  const { passwordHash: _, ...safeUser } = user;
  return safeUser as User;
}

export function updateUser(id: string, updates: Partial<Pick<User, 'name' | 'image'>>): User | null {
  loadFromFile();

  const index = users.findIndex(u => u.id === id);
  if (index === -1) return null;

  users[index] = {
    ...users[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveToFile();

  const { passwordHash: _, ...safeUser } = users[index];
  return safeUser as User;
}

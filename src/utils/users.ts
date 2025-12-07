import { User } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const USERS_FILE = path.join(process.cwd(), 'src', 'data', 'users.json');

let users: User[] = [];
let initialized = false;

function ensureDataDir(): void {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadFromFile(): void {
  if (initialized) return;

  try {
    ensureDataDir();
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      users = JSON.parse(data);
    }
  } catch {
    users = [];
  }
  initialized = true;
}

function saveToFile(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Failed to save users:', error);
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

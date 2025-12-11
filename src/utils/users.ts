import { User } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import {
  isPostgresAvailable,
  getUserByEmail as dbGetUserByEmail,
  getUserById as dbGetUserById,
  createUser as dbCreateUser,
  dbUpdateUser,
} from './db';
import { authLogger } from './logger';

// Note: isPostgresAvailable() is now a runtime check, not a module-level constant
// This ensures environment variables are evaluated fresh in serverless environments

// For local development fallback only
const isVercel = process.env.VERCEL === '1';
const DATA_DIR = isVercel
  ? '/tmp/halcyon-data'
  : path.join(process.cwd(), 'src', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Log storage mode on first use (will be logged when a user operation happens)
let storageLogged = false;
function logStorageMode() {
  if (storageLogged) return;
  storageLogged = true;

  if (isPostgresAvailable()) {
    authLogger.info('Using Vercel Postgres for persistent user storage');
  } else if (isVercel) {
    authLogger.warn('POSTGRES_URL not configured - using ephemeral /tmp storage', {
      warning: 'Users will not persist between cold starts',
    });
  } else {
    authLogger.info('Using local file storage for development');
  }
}

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
  if (initialized || isPostgresAvailable()) return;

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
  if (!fileSystemAvailable || isPostgresAvailable()) return;

  try {
    ensureDataDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.warn('Failed to save users (using in-memory only):', error);
    fileSystemAvailable = false;
  }
}

export async function createUser(email: string, password: string, name: string): Promise<User> {
  logStorageMode();  // Log which storage mode is being used
  const normalizedEmail = email.toLowerCase().trim();

  authLogger.debug('createUser called', {
    emailDomain: normalizedEmail.split('@')[1],
    postgresAvailable: isPostgresAvailable(),
  });

  // Use Postgres if available
  if (isPostgresAvailable()) {
    authLogger.debug('Checking for existing user in Postgres');

    // Check if user already exists before expensive password hashing
    const existingUser = await dbGetUserByEmail(normalizedEmail);
    if (existingUser) {
      authLogger.debug('User already exists', { userId: existingUser.id });
      throw new Error('User already exists');
    }

    // Hash password after existence check to avoid wasted computation
    authLogger.debug('Hashing password');
    const timer = authLogger.startTimer('bcrypt.hash');
    const passwordHash = await bcrypt.hash(password, 12);
    timer.end();

    authLogger.debug('Creating user in database');
    const dbUser = await dbCreateUser(normalizedEmail, name, passwordHash);
    authLogger.info('User created successfully', { userId: dbUser.id });

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    };
  }

  // Hash password for file storage
  const passwordHash = await bcrypt.hash(password, 12);

  // Fallback to file storage for local development
  loadFromFile();

  const existingUser = users.find(u => u.email.toLowerCase() === normalizedEmail);
  if (existingUser) {
    throw new Error('User already exists');
  }

  const now = new Date().toISOString();

  const user: User = {
    id: uuidv4(),
    email: normalizedEmail,
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
  const normalizedEmail = email.toLowerCase().trim();

  authLogger.debug('validateUser called', {
    emailDomain: normalizedEmail.split('@')[1],
    postgresAvailable: isPostgresAvailable(),
  });

  // Use Postgres if available
  if (isPostgresAvailable()) {
    const dbUser = await dbGetUserByEmail(normalizedEmail);
    if (!dbUser || !dbUser.passwordHash) {
      authLogger.debug('User not found or no password hash');
      return null;
    }

    const timer = authLogger.startTimer('bcrypt.compare');
    const isValid = await bcrypt.compare(password, dbUser.passwordHash);
    timer.end();

    if (!isValid) {
      authLogger.debug('Invalid password');
      return null;
    }

    authLogger.info('User validated successfully', { userId: dbUser.id });
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      image: dbUser.image || undefined,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    };
  }

  // Fallback to file storage
  loadFromFile();

  const user = users.find(u => u.email.toLowerCase() === normalizedEmail);
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

export async function getUserById(id: string): Promise<User | null> {
  // Use Postgres if available
  if (isPostgresAvailable()) {
    const dbUser = await dbGetUserById(id);
    if (!dbUser) return null;

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      image: dbUser.image || undefined,
      password: dbUser.passwordHash || '', // Include for password validation
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    };
  }

  // Fallback to file storage
  loadFromFile();
  const user = users.find(u => u.id === id);
  if (!user) return null;

  return {
    ...user,
    password: user.passwordHash || '', // Include for password validation
  } as User;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();

  // Use Postgres if available
  if (isPostgresAvailable()) {
    const dbUser = await dbGetUserByEmail(normalizedEmail);
    if (!dbUser) return null;

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      image: dbUser.image || undefined,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    };
  }

  // Fallback to file storage
  loadFromFile();
  const user = users.find(u => u.email.toLowerCase() === normalizedEmail);
  if (!user) return null;

  const { passwordHash: _, ...safeUser } = user;
  return safeUser as User;
}

export async function updateUser(id: string, updates: Partial<Pick<User, 'name' | 'image'> & { password?: string }>): Promise<User | null> {
  // Use Postgres if available
  if (isPostgresAvailable()) {
    const dbUser = await dbUpdateUser(id, updates);
    if (!dbUser) return null;

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      image: dbUser.image || undefined,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    };
  }

  // Fallback to file storage
  loadFromFile();

  const index = users.findIndex(u => u.id === id);
  if (index === -1) return null;

  // Handle password update separately
  const { password, ...otherUpdates } = updates;
  const updateData: Partial<User> = { ...otherUpdates };
  if (password) {
    updateData.passwordHash = password; // Already hashed by caller
  }

  users[index] = {
    ...users[index],
    ...updateData,
    updatedAt: new Date().toISOString(),
  };

  saveToFile();

  const { passwordHash: _, ...safeUser } = users[index];
  return safeUser as User;
}

export async function deleteUser(id: string): Promise<boolean> {
  // Use Postgres if available
  if (isPostgresAvailable()) {
    try {
      // For Postgres, we'd need to add a delete function to db.ts
      // For now, we'll throw to indicate it's not implemented for Postgres
      throw new Error('User deletion via Postgres not yet implemented');
    } catch {
      // Fall through to file storage or handle appropriately
    }
  }

  // Fallback to file storage
  loadFromFile();

  const index = users.findIndex(u => u.id === id);
  if (index === -1) return false;

  users.splice(index, 1);
  saveToFile();

  return true;
}

-- ============================================================================
-- Halcyon Cinema Database Schema (Recommended Version)
-- Run this SQL in the Supabase SQL Editor to create all required tables
--
-- IMPORTANT: This is the RECOMMENDED version for this application.
-- This app uses NextAuth + direct PostgreSQL connections (pg library),
-- NOT Supabase Auth. The RLS version (001_create_tables.sql) uses
-- auth.uid() and auth.role() which only work with Supabase Auth.
-- Authorization is handled at the application layer via NextAuth sessions.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. HELPER FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- Users table
-- Stores application profile data with NextAuth-managed authentication.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  image TEXT,
  password_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  project_type VARCHAR(50) CHECK (project_type IN ('film', 'series', 'visual-novel', 'storyboard')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scenes table
-- Note: character_ids is an array of UUIDs referencing characters(id).
-- PostgreSQL does not support foreign key constraints on array columns,
-- so referential integrity must be enforced at the application level.
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
);

-- Characters table
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
);

-- Lore table
-- Note: associated_scenes is an array of UUIDs referencing scenes(id).
-- PostgreSQL does not support foreign key constraints on array columns,
-- so referential integrity must be enforced at the application level.
CREATE TABLE IF NOT EXISTS lore (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('character', 'location', 'event', 'system')),
  name VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  associated_scenes UUID[],
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sequences table
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  shots JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_lore_project_id ON lore(project_id);
CREATE INDEX IF NOT EXISTS idx_lore_type ON lore(type);
CREATE INDEX IF NOT EXISTS idx_sequences_project_id ON sequences(project_id);

-- ============================================================================
-- 4. TRIGGERS FOR AUTO-UPDATING updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_scenes_updated_at ON scenes;
DROP TRIGGER IF EXISTS update_characters_updated_at ON characters;
DROP TRIGGER IF EXISTS update_lore_updated_at ON lore;
DROP TRIGGER IF EXISTS update_sequences_updated_at ON sequences;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenes_updated_at
  BEFORE UPDATE ON scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lore_updated_at
  BEFORE UPDATE ON lore
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sequences_updated_at
  BEFORE UPDATE ON sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

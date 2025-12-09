-- ============================================================================
-- Halcyon Cinema Database Schema (Full Version with RLS)
-- Run this SQL in the Supabase SQL Editor to create all required tables
--
-- WARNING: This version uses Supabase Auth functions (auth.uid(), auth.role())
-- which ONLY work when using Supabase Auth + Supabase client library.
--
-- This application currently uses NextAuth + direct PostgreSQL (pg library),
-- so the RECOMMENDED version is 001_create_tables_simple.sql instead.
--
-- Only use this version if you migrate to Supabase Auth for authentication.
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
-- Note: This table stores application profile data. If using Supabase Auth,
-- consider referencing auth.users(id) instead of storing password_hash here.
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

-- Primary lookup indexes
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

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE lore ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- Drop existing policies for idempotency
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('users', 'projects', 'scenes', 'characters', 'lore', 'sequences')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- USERS policies
-- Users can only see and modify their own data
-- Service role bypasses RLS for server-side operations
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id OR auth.role() = 'service_role');

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id OR auth.role() = 'service_role');

CREATE POLICY "Service role can insert users" ON users
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can delete users" ON users
  FOR DELETE USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- PROJECTS policies
-- Users can only access their own projects
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can create own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- SCENES policies
-- Users can only access scenes in projects they own
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view scenes in own projects" ON scenes
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create scenes in own projects" ON scenes
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update scenes in own projects" ON scenes
  FOR UPDATE USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete scenes in own projects" ON scenes
  FOR DELETE USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- CHARACTERS policies
-- Users can only access characters in projects they own
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view characters in own projects" ON characters
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = characters.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create characters in own projects" ON characters
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = characters.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update characters in own projects" ON characters
  FOR UPDATE USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = characters.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete characters in own projects" ON characters
  FOR DELETE USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = characters.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- LORE policies
-- Users can only access lore in projects they own
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view lore in own projects" ON lore
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = lore.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create lore in own projects" ON lore
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = lore.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update lore in own projects" ON lore
  FOR UPDATE USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = lore.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete lore in own projects" ON lore
  FOR DELETE USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = lore.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- SEQUENCES policies
-- Users can only access sequences in projects they own
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view sequences in own projects" ON sequences
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sequences.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sequences in own projects" ON sequences
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sequences.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sequences in own projects" ON sequences
  FOR UPDATE USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sequences.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sequences in own projects" ON sequences
  FOR DELETE USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sequences.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

COMMIT;

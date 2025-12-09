-- Halcyon Cinema Database Schema
-- Run this SQL in the Supabase SQL Editor to create all required tables

-- ============================================================================
-- Users table
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  image TEXT,
  password_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Projects table
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  project_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Scenes table
-- ============================================================================
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

-- ============================================================================
-- Characters table
-- ============================================================================
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

-- ============================================================================
-- Lore table
-- ============================================================================
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
);

-- ============================================================================
-- Sequences table
-- ============================================================================
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
-- Indexes for better query performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_lore_project_id ON lore(project_id);
CREATE INDEX IF NOT EXISTS idx_sequences_project_id ON sequences(project_id);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- Enable RLS on all tables for Supabase security
-- ============================================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE lore ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

-- Users policies: users can only see and modify their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text OR auth.role() = 'service_role');

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid()::text = id::text OR auth.role() = 'service_role');

CREATE POLICY "Service role can insert users" ON users
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can delete users" ON users
  FOR DELETE USING (auth.role() = 'service_role');

-- Projects policies: users can only access their own projects
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

-- Scenes policies: access based on project ownership
CREATE POLICY "Users can view scenes in own projects" ON scenes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

CREATE POLICY "Users can insert scenes in own projects" ON scenes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

CREATE POLICY "Users can update scenes in own projects" ON scenes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

CREATE POLICY "Users can delete scenes in own projects" ON scenes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

-- Characters policies: access based on project ownership
CREATE POLICY "Users can view characters in own projects" ON characters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = characters.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

CREATE POLICY "Users can insert characters in own projects" ON characters
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = characters.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

CREATE POLICY "Users can update characters in own projects" ON characters
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = characters.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

CREATE POLICY "Users can delete characters in own projects" ON characters
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = characters.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

-- Lore policies: access based on project ownership
CREATE POLICY "Users can view lore in own projects" ON lore
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = lore.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

CREATE POLICY "Users can insert lore in own projects" ON lore
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = lore.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

CREATE POLICY "Users can update lore in own projects" ON lore
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = lore.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

CREATE POLICY "Users can delete lore in own projects" ON lore
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = lore.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

-- Sequences policies: access based on project ownership
CREATE POLICY "Users can view sequences in own projects" ON sequences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sequences.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

CREATE POLICY "Users can insert sequences in own projects" ON sequences
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sequences.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

CREATE POLICY "Users can update sequences in own projects" ON sequences
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sequences.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

CREATE POLICY "Users can delete sequences in own projects" ON sequences
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sequences.project_id
      AND (auth.uid()::text = projects.user_id::text OR auth.role() = 'service_role')
    )
  );

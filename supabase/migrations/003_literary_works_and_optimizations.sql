-- ============================================================================
-- Migration: Literary Works Support & Database Optimizations
-- ============================================================================
-- This migration adds:
-- 1. Literary works tables (chapters, canon vault, extended characters/locations)
-- 2. Project mode support (literary, storyforge, cinema)
-- 3. Industry-standard database optimizations for Supabase
-- 4. Proper indexes, constraints, and performance improvements
--
-- IMPORTANT: This migration ensures users with existing literary works can
-- continue using Halcyon Cinema WITHOUT ever touching StoryForge.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. UPDATE PROJECTS TABLE FOR MODE SUPPORT
-- ============================================================================

-- Add project mode column
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'literary';

-- Add work type column
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS work_type VARCHAR(50) DEFAULT 'visual-novel';

-- Add genre column
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS genre VARCHAR(50);

-- Add synopsis/logline
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS synopsis TEXT,
  ADD COLUMN IF NOT EXISTS logline TEXT;

-- Add word count tracking
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS total_word_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_word_count INTEGER;

-- Add publishing readiness
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS publishing_readiness VARCHAR(20) DEFAULT 'draft';

-- Add canon enabled flag
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS canon_enabled BOOLEAN DEFAULT true;

-- Add last written timestamp
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS last_written_at TIMESTAMP WITH TIME ZONE;

-- Add check constraint for project mode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_mode_check'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT projects_mode_check
      CHECK (mode IN ('literary', 'storyforge', 'cinema'));
  END IF;
END $$;

-- Add check constraint for work type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_work_type_check'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT projects_work_type_check
      CHECK (work_type IN (
        'novel', 'novella', 'short-story', 'manuscript',
        'screenplay', 'teleplay', 'stage-play', 'series',
        'film', 'visual-novel', 'storyboard'
      ));
  END IF;
END $$;

-- Add check constraint for publishing readiness
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_publishing_readiness_check'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT projects_publishing_readiness_check
      CHECK (publishing_readiness IN ('draft', 'editing', 'ready'));
  END IF;
END $$;

-- ============================================================================
-- 2. CREATE CHAPTERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  number INTEGER NOT NULL,
  content TEXT DEFAULT '',
  summary TEXT,
  word_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique chapter numbers within a project
  UNIQUE(project_id, number)
);

-- Add check constraint for chapter status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chapters_status_check'
  ) THEN
    ALTER TABLE chapters ADD CONSTRAINT chapters_status_check
      CHECK (status IN ('draft', 'revision', 'final', 'published'));
  END IF;
END $$;

-- ============================================================================
-- 3. CREATE CHAPTER SCENES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS chapter_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title VARCHAR(500),
  scene_order INTEGER NOT NULL,
  content TEXT DEFAULT '',
  purpose TEXT,
  emotional_beat TEXT,
  conflict TEXT,
  resolution TEXT,
  character_ids UUID[],
  location_id UUID,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique scene order within a chapter
  UNIQUE(chapter_id, scene_order)
);

-- ============================================================================
-- 4. CREATE CANON VAULT TABLES
-- ============================================================================

-- Canon entries table
CREATE TABLE IF NOT EXISTS canon_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entry_type VARCHAR(50) NOT NULL,
  name VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  locked_at TIMESTAMP WITH TIME ZONE,
  locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add check constraint for canon entry type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'canon_entries_type_check'
  ) THEN
    ALTER TABLE canon_entries ADD CONSTRAINT canon_entries_type_check
      CHECK (entry_type IN (
        'character', 'location', 'event', 'rule',
        'theme', 'reference', 'timeline', 'relationship'
      ));
  END IF;
END $$;

-- Add check constraint for canon status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'canon_entries_status_check'
  ) THEN
    ALTER TABLE canon_entries ADD CONSTRAINT canon_entries_status_check
      CHECK (status IN ('draft', 'active', 'locked', 'deprecated'));
  END IF;
END $$;

-- Canon references table (tracks where canon is referenced)
CREATE TABLE IF NOT EXISTS canon_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canon_entry_id UUID NOT NULL REFERENCES canon_entries(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  source_id UUID NOT NULL,
  context TEXT,
  validated BOOLEAN DEFAULT false,
  validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add check constraint for source type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'canon_references_source_type_check'
  ) THEN
    ALTER TABLE canon_references ADD CONSTRAINT canon_references_source_type_check
      CHECK (source_type IN ('chapter', 'scene', 'character', 'lore', 'chapter_scene'));
  END IF;
END $$;

-- Canon validation errors table
CREATE TABLE IF NOT EXISTS canon_validation_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  canon_entry_id UUID NOT NULL REFERENCES canon_entries(id) ON DELETE CASCADE,
  source_id UUID NOT NULL,
  error_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'warning',
  suggested_resolution TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_action VARCHAR(50),
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add check constraint for error type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'canon_validation_errors_type_check'
  ) THEN
    ALTER TABLE canon_validation_errors ADD CONSTRAINT canon_validation_errors_type_check
      CHECK (error_type IN ('conflict', 'inconsistency', 'missing_reference', 'deprecated_reference'));
  END IF;
END $$;

-- Add check constraint for severity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'canon_validation_errors_severity_check'
  ) THEN
    ALTER TABLE canon_validation_errors ADD CONSTRAINT canon_validation_errors_severity_check
      CHECK (severity IN ('warning', 'error'));
  END IF;
END $$;

-- ============================================================================
-- 5. EXTEND CHARACTERS TABLE FOR LITERARY WORKS
-- ============================================================================

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(500),
  ADD COLUMN IF NOT EXISTS aliases TEXT[],
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'supporting',
  ADD COLUMN IF NOT EXISTS importance INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS backstory TEXT,
  ADD COLUMN IF NOT EXISTS motivation TEXT,
  ADD COLUMN IF NOT EXISTS character_arc TEXT,
  ADD COLUMN IF NOT EXISTS is_canon BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS canon_entry_id UUID REFERENCES canon_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_appearance_chapter_id UUID,
  ADD COLUMN IF NOT EXISTS first_appearance_scene_id UUID,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add check constraint for character role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'characters_role_check'
  ) THEN
    ALTER TABLE characters ADD CONSTRAINT characters_role_check
      CHECK (role IN ('protagonist', 'antagonist', 'deuteragonist', 'supporting', 'minor', 'mentioned'));
  END IF;
END $$;

-- Add check constraint for importance (1-10)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'characters_importance_check'
  ) THEN
    ALTER TABLE characters ADD CONSTRAINT characters_importance_check
      CHECK (importance >= 1 AND importance <= 10);
  END IF;
END $$;

-- ============================================================================
-- 6. CREATE CHARACTER RELATIONSHIPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS character_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  target_character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL,
  description TEXT,
  dynamic TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique relationships
  UNIQUE(character_id, target_character_id)
);

-- Add check constraint for relationship type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'character_relationships_type_check'
  ) THEN
    ALTER TABLE character_relationships ADD CONSTRAINT character_relationships_type_check
      CHECK (relationship_type IN ('family', 'romantic', 'friend', 'enemy', 'colleague', 'mentor', 'other'));
  END IF;
END $$;

-- ============================================================================
-- 7. CREATE LITERARY LOCATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS literary_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  atmosphere TEXT,
  significance TEXT,
  visual_details TEXT,
  image_url TEXT,
  parent_location_id UUID REFERENCES literary_locations(id) ON DELETE SET NULL,
  is_canon BOOLEAN DEFAULT false,
  canon_entry_id UUID REFERENCES canon_entries(id) ON DELETE SET NULL,
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 8. CREATE TIMELINE EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  event_date VARCHAR(100),
  relative_time VARCHAR(200),
  event_order INTEGER NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  scene_id UUID REFERENCES chapter_scenes(id) ON DELETE SET NULL,
  character_ids UUID[],
  location_id UUID REFERENCES literary_locations(id) ON DELETE SET NULL,
  is_canon BOOLEAN DEFAULT false,
  canon_entry_id UUID REFERENCES canon_entries(id) ON DELETE SET NULL,
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 9. CREATE CINEMA SHOTS TABLE (for cinema mode)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cinematic_shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  chapter_scene_id UUID REFERENCES chapter_scenes(id) ON DELETE SET NULL,
  shot_order INTEGER NOT NULL,
  shot_type VARCHAR(100),
  description TEXT,
  visual_prompt TEXT,
  mood VARCHAR(100),
  lighting VARCHAR(100),
  camera_movement VARCHAR(100),
  duration_seconds INTEGER,
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 10. INDUSTRY-STANDARD DATABASE OPTIMIZATIONS
-- ============================================================================

-- Primary lookup indexes (B-tree for equality and range queries)
CREATE INDEX IF NOT EXISTS idx_projects_mode ON projects(mode);
CREATE INDEX IF NOT EXISTS idx_projects_work_type ON projects(work_type);
CREATE INDEX IF NOT EXISTS idx_projects_user_mode ON projects(user_id, mode);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

-- Chapters indexes
CREATE INDEX IF NOT EXISTS idx_chapters_project_id ON chapters(project_id);
CREATE INDEX IF NOT EXISTS idx_chapters_project_number ON chapters(project_id, number);
CREATE INDEX IF NOT EXISTS idx_chapters_status ON chapters(status);

-- Chapter scenes indexes
CREATE INDEX IF NOT EXISTS idx_chapter_scenes_chapter_id ON chapter_scenes(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_scenes_order ON chapter_scenes(chapter_id, scene_order);

-- Canon entries indexes
CREATE INDEX IF NOT EXISTS idx_canon_entries_project_id ON canon_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_canon_entries_type ON canon_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_canon_entries_status ON canon_entries(status);
CREATE INDEX IF NOT EXISTS idx_canon_entries_project_type ON canon_entries(project_id, entry_type);

-- Canon references indexes
CREATE INDEX IF NOT EXISTS idx_canon_references_entry_id ON canon_references(canon_entry_id);
CREATE INDEX IF NOT EXISTS idx_canon_references_source ON canon_references(source_type, source_id);

-- Canon validation errors indexes
CREATE INDEX IF NOT EXISTS idx_canon_validation_errors_project ON canon_validation_errors(project_id);
CREATE INDEX IF NOT EXISTS idx_canon_validation_errors_unresolved ON canon_validation_errors(project_id, resolved) WHERE NOT resolved;

-- Character indexes
CREATE INDEX IF NOT EXISTS idx_characters_role ON characters(role);
CREATE INDEX IF NOT EXISTS idx_characters_is_canon ON characters(is_canon);
CREATE INDEX IF NOT EXISTS idx_characters_project_role ON characters(project_id, role);

-- Character relationships indexes
CREATE INDEX IF NOT EXISTS idx_character_relationships_character ON character_relationships(character_id);
CREATE INDEX IF NOT EXISTS idx_character_relationships_target ON character_relationships(target_character_id);
CREATE INDEX IF NOT EXISTS idx_character_relationships_project ON character_relationships(project_id);

-- Literary locations indexes
CREATE INDEX IF NOT EXISTS idx_literary_locations_project ON literary_locations(project_id);
CREATE INDEX IF NOT EXISTS idx_literary_locations_parent ON literary_locations(parent_location_id);
CREATE INDEX IF NOT EXISTS idx_literary_locations_is_canon ON literary_locations(is_canon);

-- Timeline events indexes
CREATE INDEX IF NOT EXISTS idx_timeline_events_project ON timeline_events(project_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_order ON timeline_events(project_id, event_order);
CREATE INDEX IF NOT EXISTS idx_timeline_events_chapter ON timeline_events(chapter_id);

-- Cinematic shots indexes
CREATE INDEX IF NOT EXISTS idx_cinematic_shots_project ON cinematic_shots(project_id);
CREATE INDEX IF NOT EXISTS idx_cinematic_shots_scene ON cinematic_shots(scene_id);
CREATE INDEX IF NOT EXISTS idx_cinematic_shots_chapter_scene ON cinematic_shots(chapter_scene_id);
CREATE INDEX IF NOT EXISTS idx_cinematic_shots_order ON cinematic_shots(project_id, shot_order);

-- Existing tables optimization indexes
CREATE INDEX IF NOT EXISTS idx_scenes_created_at ON scenes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_characters_created_at ON characters(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lore_created_at ON lore(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sequences_created_at ON sequences(created_at DESC);

-- GIN indexes for array columns (efficient for ANY/ALL operations)
CREATE INDEX IF NOT EXISTS idx_scenes_character_ids_gin ON scenes USING GIN(character_ids);
CREATE INDEX IF NOT EXISTS idx_chapter_scenes_character_ids_gin ON chapter_scenes USING GIN(character_ids);
CREATE INDEX IF NOT EXISTS idx_canon_entries_tags_gin ON canon_entries USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_characters_traits_gin ON characters USING GIN(traits);
CREATE INDEX IF NOT EXISTS idx_characters_aliases_gin ON characters USING GIN(aliases);
CREATE INDEX IF NOT EXISTS idx_lore_tags_gin ON lore USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_literary_locations_tags_gin ON literary_locations USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_timeline_events_tags_gin ON timeline_events USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_timeline_events_character_ids_gin ON timeline_events USING GIN(character_ids);

-- GIN indexes for JSONB columns (efficient for containment queries)
CREATE INDEX IF NOT EXISTS idx_characters_appearances_gin ON characters USING GIN(appearances);
CREATE INDEX IF NOT EXISTS idx_sequences_shots_gin ON sequences USING GIN(shots);
CREATE INDEX IF NOT EXISTS idx_canon_entries_metadata_gin ON canon_entries USING GIN(metadata);

-- Text search indexes (for full-text search capabilities)
CREATE INDEX IF NOT EXISTS idx_chapters_content_trgm ON chapters USING GIN(content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chapter_scenes_content_trgm ON chapter_scenes USING GIN(content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_canon_entries_summary_trgm ON canon_entries USING GIN(summary gin_trgm_ops);

-- Partial indexes (for common query patterns)
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(user_id, updated_at DESC)
  WHERE project_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chapters_draft ON chapters(project_id)
  WHERE status = 'draft';

CREATE INDEX IF NOT EXISTS idx_canon_entries_active ON canon_entries(project_id)
  WHERE status IN ('active', 'locked');

-- ============================================================================
-- 11. AUTO-UPDATE TRIGGERS FOR NEW TABLES
-- ============================================================================

-- Create trigger function if not exists (may already exist from previous migration)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Chapters
DROP TRIGGER IF EXISTS update_chapters_updated_at ON chapters;
CREATE TRIGGER update_chapters_updated_at
  BEFORE UPDATE ON chapters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Chapter scenes
DROP TRIGGER IF EXISTS update_chapter_scenes_updated_at ON chapter_scenes;
CREATE TRIGGER update_chapter_scenes_updated_at
  BEFORE UPDATE ON chapter_scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Canon entries
DROP TRIGGER IF EXISTS update_canon_entries_updated_at ON canon_entries;
CREATE TRIGGER update_canon_entries_updated_at
  BEFORE UPDATE ON canon_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Character relationships
DROP TRIGGER IF EXISTS update_character_relationships_updated_at ON character_relationships;
CREATE TRIGGER update_character_relationships_updated_at
  BEFORE UPDATE ON character_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Literary locations
DROP TRIGGER IF EXISTS update_literary_locations_updated_at ON literary_locations;
CREATE TRIGGER update_literary_locations_updated_at
  BEFORE UPDATE ON literary_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Timeline events
DROP TRIGGER IF EXISTS update_timeline_events_updated_at ON timeline_events;
CREATE TRIGGER update_timeline_events_updated_at
  BEFORE UPDATE ON timeline_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Cinematic shots
DROP TRIGGER IF EXISTS update_cinematic_shots_updated_at ON cinematic_shots;
CREATE TRIGGER update_cinematic_shots_updated_at
  BEFORE UPDATE ON cinematic_shots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 12. WORD COUNT UPDATE TRIGGER
-- ============================================================================

-- Function to update chapter word count
CREATE OR REPLACE FUNCTION update_chapter_word_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update word count based on content length (approximate)
  NEW.word_count = array_length(regexp_split_to_array(COALESCE(NEW.content, ''), '\s+'), 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_chapters_word_count ON chapters;
CREATE TRIGGER update_chapters_word_count
  BEFORE INSERT OR UPDATE OF content ON chapters
  FOR EACH ROW
  EXECUTE FUNCTION update_chapter_word_count();

-- Function to update chapter scene word count
CREATE OR REPLACE FUNCTION update_chapter_scene_word_count()
RETURNS TRIGGER AS $$
BEGIN
  NEW.word_count = array_length(regexp_split_to_array(COALESCE(NEW.content, ''), '\s+'), 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_chapter_scenes_word_count ON chapter_scenes;
CREATE TRIGGER update_chapter_scenes_word_count
  BEFORE INSERT OR UPDATE OF content ON chapter_scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_chapter_scene_word_count();

-- Function to update project total word count
CREATE OR REPLACE FUNCTION update_project_total_word_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects
  SET total_word_count = (
    SELECT COALESCE(SUM(word_count), 0)
    FROM chapters
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
  ),
  last_written_at = NOW()
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_word_count_on_chapter ON chapters;
CREATE TRIGGER update_project_word_count_on_chapter
  AFTER INSERT OR UPDATE OF word_count OR DELETE ON chapters
  FOR EACH ROW
  EXECUTE FUNCTION update_project_total_word_count();

-- ============================================================================
-- 13. ROW LEVEL SECURITY FOR NEW TABLES
-- ============================================================================

-- Enable RLS
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE canon_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE canon_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE canon_validation_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE literary_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cinematic_shots ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies follow same pattern as existing tables
-- Users can only access data in projects they own
-- Service role bypasses RLS for server-side operations

-- ============================================================================
-- 14. MIGRATE EXISTING PROJECTS TO LITERARY MODE
-- ============================================================================

-- Set existing projects to 'literary' mode by default (most permissive)
-- This ensures backward compatibility for users with existing literary works
UPDATE projects
SET mode = 'literary'
WHERE mode IS NULL;

-- Set existing visual-novel projects to keep their type
UPDATE projects
SET work_type = project_type
WHERE project_type IN ('film', 'series', 'visual-novel', 'storyboard')
  AND work_type IS NULL;

-- Default work_type for projects without one
UPDATE projects
SET work_type = 'visual-novel'
WHERE work_type IS NULL;

-- ============================================================================
-- 15. DATABASE STATISTICS AND MAINTENANCE
-- ============================================================================

-- Analyze tables to update statistics for query planner
ANALYZE users;
ANALYZE projects;
ANALYZE scenes;
ANALYZE characters;
ANALYZE lore;
ANALYZE sequences;
ANALYZE credit_transactions;
ANALYZE chapters;
ANALYZE chapter_scenes;
ANALYZE canon_entries;
ANALYZE canon_references;
ANALYZE canon_validation_errors;
ANALYZE character_relationships;
ANALYZE literary_locations;
ANALYZE timeline_events;
ANALYZE cinematic_shots;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Run separately if needed)
-- ============================================================================
-- To rollback this migration, run:
/*
BEGIN;

-- Drop new tables
DROP TABLE IF EXISTS cinematic_shots CASCADE;
DROP TABLE IF EXISTS timeline_events CASCADE;
DROP TABLE IF EXISTS literary_locations CASCADE;
DROP TABLE IF EXISTS character_relationships CASCADE;
DROP TABLE IF EXISTS canon_validation_errors CASCADE;
DROP TABLE IF EXISTS canon_references CASCADE;
DROP TABLE IF EXISTS canon_entries CASCADE;
DROP TABLE IF EXISTS chapter_scenes CASCADE;
DROP TABLE IF EXISTS chapters CASCADE;

-- Remove new columns from projects
ALTER TABLE projects
  DROP COLUMN IF EXISTS mode,
  DROP COLUMN IF EXISTS work_type,
  DROP COLUMN IF EXISTS genre,
  DROP COLUMN IF EXISTS synopsis,
  DROP COLUMN IF EXISTS logline,
  DROP COLUMN IF EXISTS total_word_count,
  DROP COLUMN IF EXISTS target_word_count,
  DROP COLUMN IF EXISTS publishing_readiness,
  DROP COLUMN IF EXISTS canon_enabled,
  DROP COLUMN IF EXISTS last_written_at;

-- Remove new columns from characters
ALTER TABLE characters
  DROP COLUMN IF EXISTS full_name,
  DROP COLUMN IF EXISTS aliases,
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS importance,
  DROP COLUMN IF EXISTS backstory,
  DROP COLUMN IF EXISTS motivation,
  DROP COLUMN IF EXISTS character_arc,
  DROP COLUMN IF EXISTS is_canon,
  DROP COLUMN IF EXISTS canon_entry_id,
  DROP COLUMN IF EXISTS first_appearance_chapter_id,
  DROP COLUMN IF EXISTS first_appearance_scene_id,
  DROP COLUMN IF EXISTS notes;

-- Drop new indexes (optional, will be dropped with tables/columns)

COMMIT;
*/

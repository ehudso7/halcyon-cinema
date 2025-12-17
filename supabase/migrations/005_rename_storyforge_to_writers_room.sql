-- ============================================================================
-- Migration: Rename storyforge mode to writers-room
-- ============================================================================
-- This migration updates the project mode constraint and existing data
-- to use 'writers-room' instead of 'storyforge' for consistency with
-- the application code after the StoryForge to Writer's Room rebrand.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. UPDATE EXISTING DATA
-- ============================================================================
-- First, update any existing projects that have mode='storyforge'
UPDATE projects SET mode = 'writers-room' WHERE mode = 'storyforge';

-- ============================================================================
-- 2. UPDATE THE CONSTRAINT
-- ============================================================================
-- Drop the old constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_mode_check;

-- Add the new constraint with 'writers-room' instead of 'storyforge'
ALTER TABLE projects ADD CONSTRAINT projects_mode_check
  CHECK (mode IN ('literary', 'writers-room', 'cinema'));

COMMIT;

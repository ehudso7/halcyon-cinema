/**
 * Database Operations for Literary Works
 *
 * This module provides database operations for:
 * - Chapters and chapter scenes
 * - Canon vault entries and references
 * - Literary locations and timeline events
 * - Character relationships
 *
 * IMPORTANT: These operations support users who want to use Halcyon Cinema
 * for literary works WITHOUT ever touching StoryForge.
 */

import { query } from './db';
import type {
  Chapter,
  ChapterScene,
  CanonEntry,
  CanonEntryType,
  CanonStatus,
  CanonReference,
  CanonValidationError,
  LiteraryCharacter,
  LiteraryLocation,
  TimelineEvent,
  CharacterRelationship,
  CharacterRole,
} from '@/types/literary';
import type { ProjectMode } from '@/config/feature-flags';

// ============================================================================
// Project Mode Operations
// ============================================================================

/**
 * Update a project's mode.
 */
export async function dbUpdateProjectMode(
  projectId: string,
  mode: ProjectMode
): Promise<boolean> {
  const result = await query(
    `UPDATE projects SET mode = $1, updated_at = NOW() WHERE id = $2::uuid RETURNING id`,
    [mode, projectId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get a project's current mode.
 */
export async function dbGetProjectMode(projectId: string): Promise<ProjectMode | null> {
  const result = await query(
    `SELECT mode FROM projects WHERE id = $1::uuid`,
    [projectId]
  );
  if (result.rows.length === 0) return null;
  return (result.rows[0] as { mode: ProjectMode }).mode;
}

// ============================================================================
// Chapter Operations
// ============================================================================

/**
 * Create a new chapter.
 */
export async function dbCreateChapter(
  projectId: string,
  title: string,
  number: number,
  content?: string
): Promise<Chapter | null> {
  const result = await query(
    `INSERT INTO chapters (project_id, title, number, content)
     VALUES ($1::uuid, $2, $3, $4)
     RETURNING *`,
    [projectId, title, number, content || '']
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return mapChapterRow(row);
}

/**
 * Get all chapters for a project.
 */
export async function dbGetProjectChapters(projectId: string): Promise<Chapter[]> {
  const result = await query(
    `SELECT * FROM chapters WHERE project_id = $1::uuid ORDER BY number ASC`,
    [projectId]
  );

  return result.rows.map(row => mapChapterRow(row as Record<string, unknown>));
}

/**
 * Get a chapter by ID.
 */
export async function dbGetChapterById(chapterId: string): Promise<Chapter | null> {
  const result = await query(
    `SELECT * FROM chapters WHERE id = $1::uuid`,
    [chapterId]
  );

  if (result.rows.length === 0) return null;
  return mapChapterRow(result.rows[0] as Record<string, unknown>);
}

/**
 * Update a chapter.
 */
export async function dbUpdateChapter(
  chapterId: string,
  updates: Partial<Pick<Chapter, 'title' | 'content' | 'summary' | 'status' | 'notes'>>
): Promise<Chapter | null> {
  await query(
    `UPDATE chapters SET
       title = COALESCE($1, title),
       content = COALESCE($2, content),
       summary = COALESCE($3, summary),
       status = COALESCE($4, status),
       notes = COALESCE($5, notes),
       updated_at = NOW()
     WHERE id = $6::uuid`,
    [
      updates.title || null,
      updates.content || null,
      updates.summary || null,
      updates.status || null,
      updates.notes || null,
      chapterId,
    ]
  );

  return dbGetChapterById(chapterId);
}

/**
 * Delete a chapter.
 */
export async function dbDeleteChapter(chapterId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM chapters WHERE id = $1::uuid`,
    [chapterId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Reorder chapters.
 */
export async function dbReorderChapters(
  projectId: string,
  chapterOrder: Array<{ id: string; number: number }>
): Promise<boolean> {
  for (const chapter of chapterOrder) {
    await query(
      `UPDATE chapters SET number = $1 WHERE id = $2::uuid AND project_id = $3::uuid`,
      [chapter.number, chapter.id, projectId]
    );
  }
  return true;
}

function mapChapterRow(row: Record<string, unknown>): Chapter {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    number: row.number as number,
    content: (row.content as string) || '',
    summary: row.summary as string | undefined,
    wordCount: (row.word_count as number) || 0,
    status: (row.status as Chapter['status']) || 'draft',
    scenes: [],
    canonReferences: [],
    notes: row.notes as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

// ============================================================================
// Chapter Scene Operations
// ============================================================================

/**
 * Create a chapter scene.
 */
export async function dbCreateChapterScene(
  chapterId: string,
  order: number,
  content?: string,
  title?: string
): Promise<ChapterScene | null> {
  const result = await query(
    `INSERT INTO chapter_scenes (chapter_id, scene_order, content, title)
     VALUES ($1::uuid, $2, $3, $4)
     RETURNING *`,
    [chapterId, order, content || '', title || null]
  );

  if (result.rows.length === 0) return null;
  return mapChapterSceneRow(result.rows[0] as Record<string, unknown>);
}

/**
 * Get scenes for a chapter.
 */
export async function dbGetChapterScenes(chapterId: string): Promise<ChapterScene[]> {
  const result = await query(
    `SELECT * FROM chapter_scenes WHERE chapter_id = $1::uuid ORDER BY scene_order ASC`,
    [chapterId]
  );

  return result.rows.map(row => mapChapterSceneRow(row as Record<string, unknown>));
}

/**
 * Update a chapter scene.
 */
export async function dbUpdateChapterScene(
  sceneId: string,
  updates: Partial<Pick<ChapterScene, 'title' | 'content' | 'purpose' | 'emotionalBeat' | 'conflict' | 'resolution' | 'characterIds' | 'locationId'>>
): Promise<ChapterScene | null> {
  await query(
    `UPDATE chapter_scenes SET
       title = COALESCE($1, title),
       content = COALESCE($2, content),
       purpose = COALESCE($3, purpose),
       emotional_beat = COALESCE($4, emotional_beat),
       conflict = COALESCE($5, conflict),
       resolution = COALESCE($6, resolution),
       character_ids = COALESCE($7::uuid[], character_ids),
       location_id = COALESCE($8::uuid, location_id),
       updated_at = NOW()
     WHERE id = $9::uuid`,
    [
      updates.title || null,
      updates.content || null,
      updates.purpose || null,
      updates.emotionalBeat || null,
      updates.conflict || null,
      updates.resolution || null,
      updates.characterIds || null,
      updates.locationId || null,
      sceneId,
    ]
  );

  const result = await query(`SELECT * FROM chapter_scenes WHERE id = $1::uuid`, [sceneId]);
  if (result.rows.length === 0) return null;
  return mapChapterSceneRow(result.rows[0] as Record<string, unknown>);
}

/**
 * Delete a chapter scene.
 */
export async function dbDeleteChapterScene(sceneId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM chapter_scenes WHERE id = $1::uuid`,
    [sceneId]
  );
  return (result.rowCount ?? 0) > 0;
}

function mapChapterSceneRow(row: Record<string, unknown>): ChapterScene {
  return {
    id: row.id as string,
    chapterId: row.chapter_id as string,
    title: row.title as string | undefined,
    order: row.scene_order as number,
    content: (row.content as string) || '',
    purpose: row.purpose as string | undefined,
    emotionalBeat: row.emotional_beat as string | undefined,
    conflict: row.conflict as string | undefined,
    resolution: row.resolution as string | undefined,
    characterIds: (row.character_ids as string[]) || [],
    locationId: row.location_id as string | undefined,
    wordCount: (row.word_count as number) || 0,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

// ============================================================================
// Canon Entry Operations
// ============================================================================

/**
 * Create a canon entry.
 */
export async function dbCreateCanonEntry(
  projectId: string,
  type: CanonEntryType,
  name: string,
  summary: string,
  description?: string,
  tags?: string[]
): Promise<CanonEntry | null> {
  const result = await query(
    `INSERT INTO canon_entries (project_id, entry_type, name, summary, description, tags)
     VALUES ($1::uuid, $2, $3, $4, $5, $6::text[])
     RETURNING *`,
    [projectId, type, name, summary, description || null, tags || []]
  );

  if (result.rows.length === 0) return null;
  return mapCanonEntryRow(result.rows[0] as Record<string, unknown>);
}

/**
 * Get all canon entries for a project.
 */
export async function dbGetProjectCanonEntries(
  projectId: string,
  type?: CanonEntryType
): Promise<CanonEntry[]> {
  let queryText = `SELECT * FROM canon_entries WHERE project_id = $1::uuid`;
  const params: unknown[] = [projectId];

  if (type) {
    queryText += ` AND entry_type = $2`;
    params.push(type);
  }

  queryText += ` ORDER BY created_at ASC`;

  const result = await query(queryText, params);
  return result.rows.map(row => mapCanonEntryRow(row as Record<string, unknown>));
}

/**
 * Get a canon entry by ID.
 */
export async function dbGetCanonEntryById(entryId: string): Promise<CanonEntry | null> {
  const result = await query(
    `SELECT * FROM canon_entries WHERE id = $1::uuid`,
    [entryId]
  );

  if (result.rows.length === 0) return null;
  return mapCanonEntryRow(result.rows[0] as Record<string, unknown>);
}

/**
 * Update a canon entry.
 */
export async function dbUpdateCanonEntry(
  entryId: string,
  updates: Partial<Pick<CanonEntry, 'name' | 'summary' | 'description' | 'status' | 'tags' | 'metadata'>>
): Promise<CanonEntry | null> {
  await query(
    `UPDATE canon_entries SET
       name = COALESCE($1, name),
       summary = COALESCE($2, summary),
       description = COALESCE($3, description),
       status = COALESCE($4, status),
       tags = COALESCE($5::text[], tags),
       metadata = COALESCE($6::jsonb, metadata),
       version = version + 1,
       updated_at = NOW()
     WHERE id = $7::uuid`,
    [
      updates.name || null,
      updates.summary || null,
      updates.description || null,
      updates.status || null,
      updates.tags || null,
      updates.metadata ? JSON.stringify(updates.metadata) : null,
      entryId,
    ]
  );

  return dbGetCanonEntryById(entryId);
}

/**
 * Lock a canon entry.
 */
export async function dbLockCanonEntry(
  entryId: string,
  lockedBy: string
): Promise<boolean> {
  const result = await query(
    `UPDATE canon_entries SET
       status = 'locked',
       locked_at = NOW(),
       locked_by = $1::uuid,
       updated_at = NOW()
     WHERE id = $2::uuid AND status != 'locked'
     RETURNING id`,
    [lockedBy, entryId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Unlock a canon entry.
 */
export async function dbUnlockCanonEntry(entryId: string): Promise<boolean> {
  const result = await query(
    `UPDATE canon_entries SET
       status = 'active',
       locked_at = NULL,
       locked_by = NULL,
       updated_at = NOW()
     WHERE id = $1::uuid AND status = 'locked'
     RETURNING id`,
    [entryId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Delete a canon entry.
 */
export async function dbDeleteCanonEntry(entryId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM canon_entries WHERE id = $1::uuid`,
    [entryId]
  );
  return (result.rowCount ?? 0) > 0;
}

function mapCanonEntryRow(row: Record<string, unknown>): CanonEntry {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    type: row.entry_type as CanonEntryType,
    name: row.name as string,
    summary: row.summary as string,
    description: row.description as string | undefined,
    status: (row.status as CanonStatus) || 'draft',
    version: (row.version as number) || 1,
    lockedAt: row.locked_at ? (row.locked_at as Date).toISOString() : undefined,
    lockedBy: row.locked_by as string | undefined,
    references: [],
    tags: (row.tags as string[]) || [],
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

// ============================================================================
// Canon Reference Operations
// ============================================================================

/**
 * Create a canon reference.
 */
export async function dbCreateCanonReference(
  canonEntryId: string,
  sourceType: string,
  sourceId: string,
  context?: string
): Promise<CanonReference | null> {
  const result = await query(
    `INSERT INTO canon_references (canon_entry_id, source_type, source_id, context)
     VALUES ($1::uuid, $2, $3::uuid, $4)
     RETURNING *`,
    [canonEntryId, sourceType, sourceId, context || null]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return {
    canonEntryId: row.canon_entry_id as string,
    sourceType: row.source_type as 'chapter' | 'scene' | 'character' | 'lore',
    sourceId: row.source_id as string,
    context: row.context as string | undefined,
    validated: (row.validated as boolean) || false,
    validatedAt: row.validated_at ? (row.validated_at as Date).toISOString() : undefined,
  };
}

/**
 * Get references for a canon entry.
 */
export async function dbGetCanonReferences(canonEntryId: string): Promise<CanonReference[]> {
  const result = await query(
    `SELECT * FROM canon_references WHERE canon_entry_id = $1::uuid`,
    [canonEntryId]
  );

  return result.rows.map(row => {
    const r = row as Record<string, unknown>;
    return {
      canonEntryId: r.canon_entry_id as string,
      sourceType: r.source_type as 'chapter' | 'scene' | 'character' | 'lore',
      sourceId: r.source_id as string,
      context: r.context as string | undefined,
      validated: (r.validated as boolean) || false,
      validatedAt: r.validated_at ? (r.validated_at as Date).toISOString() : undefined,
    };
  });
}

/**
 * Validate a canon reference.
 */
export async function dbValidateCanonReference(
  canonEntryId: string,
  sourceId: string
): Promise<boolean> {
  const result = await query(
    `UPDATE canon_references SET
       validated = true,
       validated_at = NOW()
     WHERE canon_entry_id = $1::uuid AND source_id = $2::uuid
     RETURNING id`,
    [canonEntryId, sourceId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Canon Validation Error Operations
// ============================================================================

/**
 * Create a validation error.
 */
export async function dbCreateCanonValidationError(
  projectId: string,
  canonEntryId: string,
  sourceId: string,
  errorType: string,
  message: string,
  severity: 'warning' | 'error',
  suggestedResolution?: string
): Promise<CanonValidationError | null> {
  const result = await query(
    `INSERT INTO canon_validation_errors
     (project_id, canon_entry_id, source_id, error_type, message, severity, suggested_resolution)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7)
     RETURNING *`,
    [projectId, canonEntryId, sourceId, errorType, message, severity, suggestedResolution || null]
  );

  if (result.rows.length === 0) return null;
  return mapValidationErrorRow(result.rows[0] as Record<string, unknown>);
}

/**
 * Get unresolved validation errors for a project.
 */
export async function dbGetUnresolvedValidationErrors(
  projectId: string
): Promise<CanonValidationError[]> {
  const result = await query(
    `SELECT * FROM canon_validation_errors
     WHERE project_id = $1::uuid AND resolved = false
     ORDER BY created_at DESC`,
    [projectId]
  );

  return result.rows.map(row => mapValidationErrorRow(row as Record<string, unknown>));
}

/**
 * Resolve a validation error.
 */
export async function dbResolveValidationError(
  errorId: string,
  resolvedBy: string,
  resolutionAction: string,
  resolutionNotes?: string
): Promise<boolean> {
  const result = await query(
    `UPDATE canon_validation_errors SET
       resolved = true,
       resolved_at = NOW(),
       resolved_by = $1::uuid,
       resolution_action = $2,
       resolution_notes = $3
     WHERE id = $4::uuid
     RETURNING id`,
    [resolvedBy, resolutionAction, resolutionNotes || null, errorId]
  );
  return (result.rowCount ?? 0) > 0;
}

function mapValidationErrorRow(row: Record<string, unknown>): CanonValidationError {
  return {
    id: row.id as string,
    entryId: row.canon_entry_id as string,
    sourceId: row.source_id as string,
    errorType: row.error_type as CanonValidationError['errorType'],
    message: row.message as string,
    severity: (row.severity as 'warning' | 'error') || 'warning',
    suggestedResolution: row.suggested_resolution as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

// ============================================================================
// Literary Location Operations
// ============================================================================

/**
 * Create a literary location.
 */
export async function dbCreateLiteraryLocation(
  projectId: string,
  name: string,
  description?: string,
  parentLocationId?: string
): Promise<LiteraryLocation | null> {
  const result = await query(
    `INSERT INTO literary_locations (project_id, name, description, parent_location_id)
     VALUES ($1::uuid, $2, $3, $4::uuid)
     RETURNING *`,
    [projectId, name, description || null, parentLocationId || null]
  );

  if (result.rows.length === 0) return null;
  return mapLiteraryLocationRow(result.rows[0] as Record<string, unknown>);
}

/**
 * Get all literary locations for a project.
 */
export async function dbGetProjectLiteraryLocations(projectId: string): Promise<LiteraryLocation[]> {
  const result = await query(
    `SELECT * FROM literary_locations WHERE project_id = $1::uuid ORDER BY name ASC`,
    [projectId]
  );

  return result.rows.map(row => mapLiteraryLocationRow(row as Record<string, unknown>));
}

/**
 * Update a literary location.
 */
export async function dbUpdateLiteraryLocation(
  locationId: string,
  updates: Partial<Pick<LiteraryLocation, 'name' | 'description' | 'atmosphere' | 'significance' | 'visualDetails' | 'imageUrl' | 'parentLocationId' | 'tags' | 'notes'>>
): Promise<LiteraryLocation | null> {
  await query(
    `UPDATE literary_locations SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       atmosphere = COALESCE($3, atmosphere),
       significance = COALESCE($4, significance),
       visual_details = COALESCE($5, visual_details),
       image_url = COALESCE($6, image_url),
       parent_location_id = COALESCE($7::uuid, parent_location_id),
       tags = COALESCE($8::text[], tags),
       notes = COALESCE($9, notes),
       updated_at = NOW()
     WHERE id = $10::uuid`,
    [
      updates.name || null,
      updates.description || null,
      updates.atmosphere || null,
      updates.significance || null,
      updates.visualDetails || null,
      updates.imageUrl || null,
      updates.parentLocationId || null,
      updates.tags || null,
      updates.notes || null,
      locationId,
    ]
  );

  const result = await query(`SELECT * FROM literary_locations WHERE id = $1::uuid`, [locationId]);
  if (result.rows.length === 0) return null;
  return mapLiteraryLocationRow(result.rows[0] as Record<string, unknown>);
}

/**
 * Delete a literary location.
 */
export async function dbDeleteLiteraryLocation(locationId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM literary_locations WHERE id = $1::uuid`,
    [locationId]
  );
  return (result.rowCount ?? 0) > 0;
}

function mapLiteraryLocationRow(row: Record<string, unknown>): LiteraryLocation {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    atmosphere: row.atmosphere as string | undefined,
    significance: row.significance as string | undefined,
    visualDetails: row.visual_details as string | undefined,
    imageUrl: row.image_url as string | undefined,
    parentLocationId: row.parent_location_id as string | undefined,
    isCanon: (row.is_canon as boolean) || false,
    canonEntryId: row.canon_entry_id as string | undefined,
    tags: (row.tags as string[]) || [],
    notes: row.notes as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

// ============================================================================
// Timeline Event Operations
// ============================================================================

/**
 * Create a timeline event.
 */
export async function dbCreateTimelineEvent(
  projectId: string,
  name: string,
  order: number,
  description?: string
): Promise<TimelineEvent | null> {
  const result = await query(
    `INSERT INTO timeline_events (project_id, name, event_order, description)
     VALUES ($1::uuid, $2, $3, $4)
     RETURNING *`,
    [projectId, name, order, description || null]
  );

  if (result.rows.length === 0) return null;
  return mapTimelineEventRow(result.rows[0] as Record<string, unknown>);
}

/**
 * Get all timeline events for a project.
 */
export async function dbGetProjectTimelineEvents(projectId: string): Promise<TimelineEvent[]> {
  const result = await query(
    `SELECT * FROM timeline_events WHERE project_id = $1::uuid ORDER BY event_order ASC`,
    [projectId]
  );

  return result.rows.map(row => mapTimelineEventRow(row as Record<string, unknown>));
}

/**
 * Update a timeline event.
 */
export async function dbUpdateTimelineEvent(
  eventId: string,
  updates: Partial<Pick<TimelineEvent, 'name' | 'description' | 'date' | 'relativeTime' | 'order' | 'chapterId' | 'sceneId' | 'characterIds' | 'locationId' | 'tags' | 'notes'>>
): Promise<TimelineEvent | null> {
  await query(
    `UPDATE timeline_events SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       event_date = COALESCE($3, event_date),
       relative_time = COALESCE($4, relative_time),
       event_order = COALESCE($5, event_order),
       chapter_id = COALESCE($6::uuid, chapter_id),
       scene_id = COALESCE($7::uuid, scene_id),
       character_ids = COALESCE($8::uuid[], character_ids),
       location_id = COALESCE($9::uuid, location_id),
       tags = COALESCE($10::text[], tags),
       notes = COALESCE($11, notes),
       updated_at = NOW()
     WHERE id = $12::uuid`,
    [
      updates.name || null,
      updates.description || null,
      updates.date || null,
      updates.relativeTime || null,
      updates.order || null,
      updates.chapterId || null,
      updates.sceneId || null,
      updates.characterIds || null,
      updates.locationId || null,
      updates.tags || null,
      updates.notes || null,
      eventId,
    ]
  );

  const result = await query(`SELECT * FROM timeline_events WHERE id = $1::uuid`, [eventId]);
  if (result.rows.length === 0) return null;
  return mapTimelineEventRow(result.rows[0] as Record<string, unknown>);
}

/**
 * Delete a timeline event.
 */
export async function dbDeleteTimelineEvent(eventId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM timeline_events WHERE id = $1::uuid`,
    [eventId]
  );
  return (result.rowCount ?? 0) > 0;
}

function mapTimelineEventRow(row: Record<string, unknown>): TimelineEvent {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    date: row.event_date as string | undefined,
    relativeTime: row.relative_time as string | undefined,
    order: row.event_order as number,
    chapterId: row.chapter_id as string | undefined,
    sceneId: row.scene_id as string | undefined,
    characterIds: (row.character_ids as string[]) || [],
    locationId: row.location_id as string | undefined,
    isCanon: (row.is_canon as boolean) || false,
    canonEntryId: row.canon_entry_id as string | undefined,
    tags: (row.tags as string[]) || [],
    notes: row.notes as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

// ============================================================================
// Character Relationship Operations
// ============================================================================

/**
 * Create a character relationship.
 */
export async function dbCreateCharacterRelationship(
  projectId: string,
  characterId: string,
  targetCharacterId: string,
  relationshipType: CharacterRelationship['type'],
  description?: string
): Promise<CharacterRelationship | null> {
  const result = await query(
    `INSERT INTO character_relationships (project_id, character_id, target_character_id, relationship_type, description)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5)
     RETURNING *`,
    [projectId, characterId, targetCharacterId, relationshipType, description || null]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return {
    targetCharacterId: row.target_character_id as string,
    type: row.relationship_type as CharacterRelationship['type'],
    description: row.description as string | undefined,
    dynamic: row.dynamic as string | undefined,
  };
}

/**
 * Get relationships for a character.
 */
export async function dbGetCharacterRelationships(characterId: string): Promise<CharacterRelationship[]> {
  const result = await query(
    `SELECT * FROM character_relationships WHERE character_id = $1::uuid`,
    [characterId]
  );

  return result.rows.map(row => {
    const r = row as Record<string, unknown>;
    return {
      targetCharacterId: r.target_character_id as string,
      type: r.relationship_type as CharacterRelationship['type'],
      description: r.description as string | undefined,
      dynamic: r.dynamic as string | undefined,
    };
  });
}

/**
 * Update a character relationship.
 */
export async function dbUpdateCharacterRelationship(
  characterId: string,
  targetCharacterId: string,
  updates: Partial<Pick<CharacterRelationship, 'type' | 'description' | 'dynamic'>>
): Promise<boolean> {
  const result = await query(
    `UPDATE character_relationships SET
       relationship_type = COALESCE($1, relationship_type),
       description = COALESCE($2, description),
       dynamic = COALESCE($3, dynamic),
       updated_at = NOW()
     WHERE character_id = $4::uuid AND target_character_id = $5::uuid
     RETURNING id`,
    [
      updates.type || null,
      updates.description || null,
      updates.dynamic || null,
      characterId,
      targetCharacterId,
    ]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Delete a character relationship.
 */
export async function dbDeleteCharacterRelationship(
  characterId: string,
  targetCharacterId: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM character_relationships
     WHERE character_id = $1::uuid AND target_character_id = $2::uuid`,
    [characterId, targetCharacterId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Extended Character Operations
// ============================================================================

/**
 * Update extended character fields.
 */
export async function dbUpdateCharacterExtended(
  characterId: string,
  updates: {
    fullName?: string;
    aliases?: string[];
    role?: CharacterRole;
    importance?: number;
    backstory?: string;
    motivation?: string;
    characterArc?: string;
    isCanon?: boolean;
    canonEntryId?: string;
    notes?: string;
  }
): Promise<boolean> {
  const result = await query(
    `UPDATE characters SET
       full_name = COALESCE($1, full_name),
       aliases = COALESCE($2::text[], aliases),
       role = COALESCE($3, role),
       importance = COALESCE($4, importance),
       backstory = COALESCE($5, backstory),
       motivation = COALESCE($6, motivation),
       character_arc = COALESCE($7, character_arc),
       is_canon = COALESCE($8, is_canon),
       canon_entry_id = COALESCE($9::uuid, canon_entry_id),
       notes = COALESCE($10, notes),
       updated_at = NOW()
     WHERE id = $11::uuid
     RETURNING id`,
    [
      updates.fullName || null,
      updates.aliases || null,
      updates.role || null,
      updates.importance || null,
      updates.backstory || null,
      updates.motivation || null,
      updates.characterArc || null,
      updates.isCanon ?? null,
      updates.canonEntryId || null,
      updates.notes || null,
      characterId,
    ]
  );
  return (result.rowCount ?? 0) > 0;
}

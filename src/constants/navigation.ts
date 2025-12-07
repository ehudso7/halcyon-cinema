/**
 * Shared navigation constants for project pages
 */

export const PROJECT_TABS = [
  { id: 'scenes', label: 'Scenes', icon: '🎬' },
  { id: 'lore', label: 'World Lore', icon: '📚' },
  { id: 'characters', label: 'Characters', icon: '👤' },
  { id: 'sequence', label: 'Scene Flow', icon: '🎞️' },
] as const;

export type ProjectTabId = typeof PROJECT_TABS[number]['id'];

/**
 * Helper to get the href for a project tab
 */
export function getProjectTabHref(projectId: string, tabId: ProjectTabId): string {
  return tabId === 'scenes' ? `/project/${projectId}` : `/project/${projectId}/${tabId}`;
}

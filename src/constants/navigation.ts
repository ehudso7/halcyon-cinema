/**
 * Shared navigation constants for project pages
 */

export const PROJECT_TABS = [
  { id: 'scenes', label: 'Scenes', icon: 'film' },
  { id: 'lore', label: 'World Lore', icon: 'book' },
  { id: 'characters', label: 'Characters', icon: 'user' },
  { id: 'sequence', label: 'Scene Flow', icon: 'filmstrip' },
] as const;

export type ProjectTabId = typeof PROJECT_TABS[number]['id'];

/**
 * Helper to get the href for a project tab
 */
export function getProjectTabHref(projectId: string, tabId: ProjectTabId): string {
  return tabId === 'scenes' ? `/project/${projectId}` : `/project/${projectId}/${tabId}`;
}

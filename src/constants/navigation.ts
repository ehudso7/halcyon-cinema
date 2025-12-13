/**
 * Shared navigation constants for project pages
 */

import React from 'react';
import { FilmIcon, BookIcon, UserIcon, FilmStripIcon } from '@/components/Icons';

export interface ProjectTab {
  id: string;
  label: string;
  IconComponent: React.FC<{ size?: number; color?: string }>;
}

export const PROJECT_TABS: ProjectTab[] = [
  { id: 'scenes', label: 'Scenes', IconComponent: FilmIcon },
  { id: 'lore', label: 'World Lore', IconComponent: BookIcon },
  { id: 'characters', label: 'Characters', IconComponent: UserIcon },
  { id: 'sequence', label: 'Scene Flow', IconComponent: FilmStripIcon },
];

export type ProjectTabId = ProjectTab['id'];

/**
 * Helper to get the href for a project tab
 */
export function getProjectTabHref(projectId: string, tabId: ProjectTabId): string {
  return tabId === 'scenes' ? `/project/${projectId}` : `/project/${projectId}/${tabId}`;
}

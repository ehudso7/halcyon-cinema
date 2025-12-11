import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './[...nextauth]';
import { getUserById } from '@/utils/users';
import { getAllProjectsAsync, getProjectLoreAsync } from '@/utils/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get user data (excluding sensitive fields)
    const user = await getUserById(session.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove sensitive fields before export
    const { password: _pw, passwordHash: _ph, ...safeUser } = user;

    // Get all projects with their content
    const projects = await getAllProjectsAsync(session.user.id);
    const projectsWithContent = await Promise.all(
      projects.map(async (project) => {
        // Get lore for each project
        const lore = await getProjectLoreAsync(project.id);

        return {
          ...project,
          lore,
        };
      })
    );

    const exportData = {
      exportDate: new Date().toISOString(),
      user: safeUser,
      projects: projectsWithContent,
      metadata: {
        totalProjects: projects.length,
        totalScenes: projectsWithContent.reduce((sum, p) => sum + (p.scenes?.length || 0), 0),
        totalCharacters: projectsWithContent.reduce((sum, p) => sum + (p.characters?.length || 0), 0),
        totalLore: projectsWithContent.reduce((sum, p) => sum + (p.lore?.length || 0), 0),
      },
    };

    // Set headers for JSON download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="halcyon-data-${session.user.id}-${new Date().toISOString().split('T')[0]}.json"`
    );

    return res.status(200).json(exportData);
  } catch (error) {
    console.error('Error exporting data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

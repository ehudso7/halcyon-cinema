import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './[...nextauth]';
import { deleteUser } from '@/utils/users';
import { getAllProjectsAsync, deleteProjectAsync } from '@/utils/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Delete all user's projects first
    const projects = await getAllProjectsAsync(session.user.id);
    for (const project of projects) {
      await deleteProjectAsync(project.id);
    }

    // Delete the user account
    await deleteUser(session.user.id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

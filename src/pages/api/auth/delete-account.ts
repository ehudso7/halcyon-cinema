import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuthWithCSRF } from '@/utils/api-auth';
import { deleteUser } from '@/utils/users';
import { getAllProjectsAsync, deleteProjectAsync } from '@/utils/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Require authentication with CSRF protection for account deletion
  const userId = await requireAuthWithCSRF(req, res);
  if (!userId) return;

  try {
    // Delete all user's projects first
    const projects = await getAllProjectsAsync(userId);
    for (const project of projects) {
      await deleteProjectAsync(project.id);
    }

    // Delete the user account
    await deleteUser(userId);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

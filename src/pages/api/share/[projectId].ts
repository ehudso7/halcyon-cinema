import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { dbGetProjectById, query, isPostgresAvailable } from '@/utils/db';
import { randomBytes } from 'crypto';

interface ShareResponse {
  success: boolean;
  shareUrl?: string;
  shareId?: string;
  isPublic?: boolean;
  error?: string;
}

// Initialize shares table if needed
async function initSharesTable() {
  if (!isPostgresAvailable()) return;

  await query(`
    CREATE TABLE IF NOT EXISTS project_shares (
      id VARCHAR(32) PRIMARY KEY,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_public BOOLEAN DEFAULT true,
      view_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE,
      UNIQUE(project_id)
    )
  `);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ShareResponse>
) {
  const { projectId } = req.query;

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ success: false, error: 'Project ID is required' });
  }

  // GET: Check share status or get public share
  if (req.method === 'GET') {
    const session = await getServerSession(req, res, authOptions);
    const { shareId } = req.query;

    try {
      await initSharesTable();

      // If shareId is provided, it's a public access request
      if (shareId) {
        const result = await query(
          `SELECT ps.*, p.name as project_name
           FROM project_shares ps
           JOIN projects p ON ps.project_id = p.id
           WHERE ps.id = $1 AND ps.is_public = true
           AND (ps.expires_at IS NULL OR ps.expires_at > NOW())`,
          [shareId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Share not found or expired' });
        }

        // Increment view count
        await query(
          'UPDATE project_shares SET view_count = view_count + 1 WHERE id = $1',
          [shareId]
        );

        return res.status(200).json({
          success: true,
          isPublic: true,
        });
      }

      // Otherwise check if user owns the project and get share status
      if (!session?.user?.id) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      // Verify user owns this project before returning share status
      const project = await dbGetProjectById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }
      if (project.userId !== session.user.id) {
        return res.status(403).json({ success: false, error: 'Not authorized to access this project' });
      }

      const result = await query(
        'SELECT * FROM project_shares WHERE project_id = $1::uuid',
        [projectId]
      );

      if (result.rows.length > 0) {
        const share = result.rows[0] as { id: string; is_public: boolean };
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

        return res.status(200).json({
          success: true,
          shareId: share.id,
          shareUrl: `${baseUrl}/shared/${share.id}`,
          isPublic: share.is_public,
        });
      }

      return res.status(200).json({ success: true, isPublic: false });
    } catch (error) {
      console.error('[share] GET error:', error);
      return res.status(500).json({ success: false, error: 'Failed to get share status' });
    }
  }

  // POST: Create or update share
  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      await initSharesTable();

      // Verify user owns the project
      const project = await dbGetProjectById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }

      if (project.userId !== session.user.id) {
        return res.status(403).json({ success: false, error: 'Not authorized to share this project' });
      }

      // Check if share already exists
      const existing = await query(
        'SELECT id FROM project_shares WHERE project_id = $1::uuid',
        [projectId]
      );

      let shareId: string;

      if (existing.rows.length > 0) {
        // Update existing share
        shareId = (existing.rows[0] as { id: string }).id;
        await query(
          'UPDATE project_shares SET is_public = true WHERE id = $1',
          [shareId]
        );
      } else {
        // Create new share
        shareId = randomBytes(16).toString('hex');
        await query(
          `INSERT INTO project_shares (id, project_id, user_id, is_public)
           VALUES ($1, $2::uuid, $3::uuid, true)`,
          [shareId, projectId, session.user.id]
        );
      }

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

      return res.status(200).json({
        success: true,
        shareId,
        shareUrl: `${baseUrl}/shared/${shareId}`,
        isPublic: true,
      });
    } catch (error) {
      console.error('[share] POST error:', error);
      return res.status(500).json({ success: false, error: 'Failed to create share link' });
    }
  }

  // DELETE: Remove share
  if (req.method === 'DELETE') {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      await query(
        'DELETE FROM project_shares WHERE project_id = $1::uuid AND user_id = $2::uuid',
        [projectId, session.user.id]
      );

      return res.status(200).json({ success: true, isPublic: false });
    } catch (error) {
      console.error('[share] DELETE error:', error);
      return res.status(500).json({ success: false, error: 'Failed to remove share' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });
}

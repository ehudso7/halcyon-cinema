import type { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes, createHash } from 'crypto';
import { getUserByEmail, query, isPostgresAvailable } from '@/utils/db';
import { sendEmail, getPasswordResetEmailHtml } from '@/utils/email';

interface ForgotPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Initialize password reset tokens table
async function initResetTokensTable() {
  if (!isPostgresAvailable()) return;

  await query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Create index for faster token lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash
    ON password_reset_tokens(token_hash) WHERE used = false
  `);
}

// Hash the token before storing (so plaintext token is never stored)
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ForgotPasswordResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    });
  }

  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email format'
    });
  }

  try {
    await initResetTokensTable();

    // Check if user exists (but don't reveal this to the client for security)
    const user = await getUserByEmail(email.toLowerCase());

    if (user && isPostgresAvailable()) {
      // Invalidate any existing reset tokens for this user
      await query(
        'UPDATE password_reset_tokens SET used = true WHERE user_id = $1::uuid AND used = false',
        [user.id]
      );

      // Generate a secure reset token
      const token = randomBytes(32).toString('hex');
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour expiration

      // Store the hashed token in database
      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1::uuid, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );

      // Generate the reset URL
      const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;

      // Send the password reset email
      const emailResult = await sendEmail({
        to: email.toLowerCase(),
        subject: 'Reset your HALCYON-Cinema password',
        html: getPasswordResetEmailHtml(resetUrl, user.name),
      });

      if (!emailResult.success) {
        console.error('[forgot-password] Failed to send email:', emailResult.error);
        // Don't reveal email sending failure to prevent enumeration
      } else if (process.env.NODE_ENV === 'development') {
        console.log('[forgot-password] Reset link generated:', { email: email.toLowerCase(), resetUrl });
      }
    }

    // Always return success to prevent email enumeration
    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a reset link has been sent.',
    });
  } catch (error) {
    console.error('[forgot-password] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'An error occurred. Please try again later.',
    });
  }
}

// Verify a reset token - returns user ID if valid
export async function verifyResetToken(token: string): Promise<{ userId: string; email: string } | null> {
  if (!isPostgresAvailable()) return null;

  await initResetTokensTable();

  const tokenHash = hashToken(token);

  const result = await query(
    `SELECT prt.user_id, u.email
     FROM password_reset_tokens prt
     JOIN users u ON prt.user_id = u.id
     WHERE prt.token_hash = $1
       AND prt.used = false
       AND prt.expires_at > NOW()`,
    [tokenHash]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as { user_id: string; email: string };
  return { userId: row.user_id, email: row.email };
}

// Invalidate a reset token after use
export async function invalidateResetToken(token: string): Promise<void> {
  if (!isPostgresAvailable()) return;

  const tokenHash = hashToken(token);

  await query(
    'UPDATE password_reset_tokens SET used = true WHERE token_hash = $1',
    [tokenHash]
  );
}

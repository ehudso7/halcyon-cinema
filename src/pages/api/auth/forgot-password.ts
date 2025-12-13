import type { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes } from 'crypto';
import { getUserByEmail } from '@/utils/db';

// In production, you would use a proper email service (SendGrid, AWS SES, etc.)
// and store tokens in the database with expiration times

interface ForgotPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Simple in-memory token store (replace with database in production)
const resetTokens = new Map<string, { email: string; expires: number }>();

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
    // Check if user exists (but don't reveal this to the client for security)
    const user = await getUserByEmail(email.toLowerCase());

    if (user) {
      // Generate a secure reset token
      const token = randomBytes(32).toString('hex');
      const expires = Date.now() + 3600000; // 1 hour expiration

      // Store the token (in production, save to database)
      resetTokens.set(token, { email: email.toLowerCase(), expires });

      // In production, send an email with the reset link
      // For now, log it (development only)
      const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;

      console.log('[forgot-password] Reset link generated:', {
        email: email.toLowerCase(),
        resetUrl,
        // Don't log token in production
      });

      // TODO: Implement actual email sending
      // await sendEmail({
      //   to: email,
      //   subject: 'Reset your HALCYON-Cinema password',
      //   html: `Click here to reset your password: ${resetUrl}`
      // });
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

// Export for use in reset-password endpoint
export function verifyResetToken(token: string): { email: string } | null {
  const data = resetTokens.get(token);
  if (!data) return null;
  if (Date.now() > data.expires) {
    resetTokens.delete(token);
    return null;
  }
  return { email: data.email };
}

export function invalidateResetToken(token: string): void {
  resetTokens.delete(token);
}

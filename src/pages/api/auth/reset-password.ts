import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { verifyResetToken, invalidateResetToken } from './forgot-password';
import { updateUserPassword } from '@/utils/users';

interface ResetPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResetPasswordResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    });
  }

  const { token, password } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Reset token is required'
    });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 8 characters'
    });
  }

  try {
    // Verify the token (now async since it queries the database)
    const tokenData = await verifyResetToken(token);
    if (!tokenData) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset link'
      });
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update the password using the userId from the token
    const updated = await updateUserPassword(tokenData.userId, passwordHash);
    if (!updated) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update password'
      });
    }

    // Invalidate the token so it can't be reused
    await invalidateResetToken(token);

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('[reset-password] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'An error occurred. Please try again later.'
    });
  }
}

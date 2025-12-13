import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { verifyResetToken, invalidateResetToken } from './forgot-password';
import { getUserByEmail } from '@/utils/db';
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

  // Verify the token
  const tokenData = verifyResetToken(token);
  if (!tokenData) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or expired reset link'
    });
  }

  try {
    // Get the user
    const user = await getUserByEmail(tokenData.email);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update the password
    const updated = await updateUserPassword(user.id, passwordHash);
    if (!updated) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update password'
      });
    }

    // Invalidate the token so it can't be reused
    invalidateResetToken(token);

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

import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyResetToken } from './forgot-password';

interface VerifyTokenResponse {
  valid: boolean;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VerifyTokenResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      valid: false,
      error: `Method ${req.method} not allowed`
    });
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      valid: false,
      error: 'Token is required'
    });
  }

  const result = verifyResetToken(token);

  if (!result) {
    return res.status(200).json({
      valid: false,
      error: 'Invalid or expired reset link'
    });
  }

  return res.status(200).json({ valid: true });
}

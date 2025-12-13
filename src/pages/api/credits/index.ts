import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { getUserCredits, getCreditTransactions, UserCredits, CreditTransaction } from '@/utils/db';

interface CreditsResponse {
  credits: UserCredits;
  transactions?: CreditTransaction[];
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreditsResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Require authentication
  const userId = await requireAuth(req, res);
  if (!userId) return;

  try {
    const credits = await getUserCredits(userId);

    if (!credits) {
      return res.status(404).json({ error: 'User credits not found' });
    }

    // Optionally include transaction history
    const includeHistory = req.query.history === 'true';
    const transactions = includeHistory
      ? await getCreditTransactions(userId, 20)
      : undefined;

    return res.status(200).json({
      credits,
      transactions,
    });
  } catch (error) {
    console.error('[api/credits] Error fetching credits:', error);
    return res.status(500).json({ error: 'Failed to fetch credits' });
  }
}

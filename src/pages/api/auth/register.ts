import type { NextApiRequest, NextApiResponse } from 'next';
import { createUser } from '@/utils/users';
import { ApiError, User } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ user: Omit<User, 'passwordHash'> } | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { email, password, name } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const user = await createUser(email, password, name);
    return res.status(201).json({ user });
  } catch (error) {
    if (error instanceof Error && error.message === 'User already exists') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Failed to create account' });
  }
}

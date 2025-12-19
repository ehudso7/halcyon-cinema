import { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      subscriptionTier?: 'starter' | 'pro' | 'enterprise';
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    id: string;
    subscriptionTier?: 'starter' | 'pro' | 'enterprise';
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    subscriptionTier?: 'starter' | 'pro' | 'enterprise';
  }
}

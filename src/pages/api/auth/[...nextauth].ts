import NextAuth, { NextAuthOptions, Account, Profile } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { validateUser, createUser, getUserByEmail } from '@/utils/users';

// Build providers array dynamically based on available env vars
const providers = [];

// Always add credentials provider
providers.push(
  CredentialsProvider({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const user = await validateUser(credentials.email, credentials.password);

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  })
);

// Add Google OAuth if configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

// Add GitHub OAuth if configured
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })
  );
}

// Helper to handle OAuth sign-in
async function handleOAuthSignIn(
  account: Account | null,
  profile: Profile | undefined
): Promise<boolean> {
  if (!account || !profile?.email) return false;

  try {
    // Check if user exists
    const existingUser = await getUserByEmail(profile.email);

    if (!existingUser) {
      // Create new user for OAuth sign-in (no password)
      await createUser(
        profile.email,
        '', // Empty password for OAuth users
        profile.name || profile.email.split('@')[0]
      );
    }

    return true;
  } catch (error) {
    console.error('[auth] OAuth sign-in error:', error);
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle OAuth sign-ins
      if (account?.provider !== 'credentials') {
        return handleOAuthSignIn(account, profile);
      }
      return true;
    },
    async jwt({ token, user, trigger, session, account, profile }) {
      // For OAuth sign-ins, get/create user ID from database
      if (account?.provider !== 'credentials' && profile?.email) {
        const dbUser = await getUserByEmail(profile.email);
        if (dbUser) {
          token.id = dbUser.id;
          token.name = dbUser.name || profile.name;
          token.image = dbUser.image || (profile as { picture?: string }).picture;
        }
      } else if (user) {
        token.id = user.id;
        token.name = user.name;
        token.image = user.image;
      }
      // Handle session updates from client
      if (trigger === 'update' && session) {
        // Update token with new values from client
        if (session.name !== undefined) {
          token.name = session.name;
        }
        if (session.image !== undefined) {
          token.image = session.image;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.image = token.image as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  // NEXTAUTH_SECRET is required - set it in Vercel environment variables for production
  // For local development, set it in .env.local (e.g., run: openssl rand -base64 32)
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);

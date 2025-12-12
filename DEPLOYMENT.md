# Deployment Guide for HALCYON-Cinema

This guide covers deploying HALCYON-Cinema to Vercel with Supabase as the database.

## Prerequisites

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **Supabase Account** - Sign up at [supabase.com](https://supabase.com)
3. **OpenAI API Key** - Get one at [platform.openai.com](https://platform.openai.com/api-keys)

## Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ehudso7/halcyon-cinema)

## Step-by-Step Deployment

### 1. Set Up Supabase Database

1. Create a new project in Supabase
2. Go to **Project Settings** → **Database**
3. Copy the connection string (use the "Pooler" connection for Vercel)

### 2. Connect Vercel to Supabase

**Option A: Vercel Storage Integration (Recommended)**
1. In your Vercel project, go to **Storage** tab
2. Click **Create Database** → **Supabase**
3. Follow the prompts to connect your Supabase project
4. Environment variables will be automatically configured

**Option B: Manual Configuration**
Add these environment variables in Vercel Dashboard → Settings → Environment Variables:

### 3. Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXTAUTH_SECRET` | Random string for session encryption. Generate with: `openssl rand -base64 32` | **Yes** |
| `NEXTAUTH_URL` | Your deployment URL (e.g., `https://your-app.vercel.app`) | **Yes** |
| `POSTGRES_URL` | Supabase PostgreSQL connection URL (use pooler) | **Yes** |
| `OPENAI_API_KEY` | Your OpenAI API key for AI features | **Yes** |

#### Database Variables (if not using Vercel Storage integration)

| Variable | Description |
|----------|-------------|
| `POSTGRES_URL` | Primary PostgreSQL URL |
| `POSTGRES_PRISMA_URL` | URL with pgbouncer for Prisma |
| `POSTGRES_URL_NON_POOLING` | Direct connection URL |
| `POSTGRES_HOST` | Database host |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `POSTGRES_DATABASE` | Database name |

#### Supabase Storage Variables (for image persistence)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |

### 4. Set Up Supabase Storage (for Image Persistence)

Without Supabase Storage, generated images will use temporary OpenAI URLs that expire after ~1 hour.

1. In Supabase Dashboard, go to **Storage**
2. Create a new bucket called `scene-images`
3. Set the bucket to **Public** (or configure RLS policies)
4. Get your keys from **Project Settings** → **API**

### 5. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# For production
vercel --prod
```

## Troubleshooting

### "Database service unavailable" Error

This means the database connection is not configured. Check:

1. **Environment variables are set**: Ensure `POSTGRES_URL` or all individual components are configured
2. **Connection string is correct**: Use the pooler connection (port 6543) for Vercel
3. **SSL is configured**: Vercel handles SSL automatically, but ensure `sslmode=require` is in your connection string

### AI Features Not Working

1. **Check OPENAI_API_KEY**: Ensure it's set in Vercel environment variables
2. **Check API quota**: Verify you have credits in your OpenAI account
3. **Check logs**: View Vercel function logs for specific errors

### Images Not Persisting

1. **Configure Supabase Storage**: Set up the `scene-images` bucket
2. **Set environment variables**: Add `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL`
3. **Check bucket permissions**: Ensure the bucket allows public read access

## Environment Variable Examples

```env
# Authentication (REQUIRED)
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=https://your-app.vercel.app

# Database (REQUIRED - from Supabase)
POSTGRES_URL=postgres://postgres.xxxx:password@aws-0-region.pooler.supabase.com:6543/postgres

# AI Features (REQUIRED for image/story generation)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# Supabase Storage (OPTIONAL but recommended)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Post-Deployment Checklist

- [ ] Test user registration/login
- [ ] Create a test project
- [ ] Test Quick Create with image generation
- [ ] Verify images persist after page refresh
- [ ] Test export functionality

## Support

If you encounter issues:

1. Check the [Vercel deployment logs](https://vercel.com/docs/concepts/deployments/logs)
2. Review [Supabase connection guides](https://supabase.com/docs/guides/database/connecting-to-postgres)
3. Open an issue on [GitHub](https://github.com/ehudso7/halcyon-cinema/issues)

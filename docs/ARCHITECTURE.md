# HALCYON-Cinema Architecture

This document describes the system architecture, design decisions, and technical implementation of HALCYON-Cinema.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Data Model](#data-model)
- [Authentication](#authentication)
- [AI Integration](#ai-integration)
- [Storage](#storage)
- [Frontend Architecture](#frontend-architecture)
- [API Design](#api-design)
- [Security](#security)
- [Performance](#performance)
- [Testing Strategy](#testing-strategy)
- [Deployment](#deployment)

---

## Overview

HALCYON-Cinema is a full-stack web application built with modern technologies:

- **Frontend**: Next.js 16 with React 19
- **Backend**: Next.js API Routes (serverless)
- **Database**: PostgreSQL via Supabase
- **AI**: OpenAI APIs (DALL-E 3, GPT-4o-mini)
- **Authentication**: NextAuth.js with JWT
- **Deployment**: Vercel Edge Network

### Design Principles

1. **Simplicity**: Minimize complexity while maintaining extensibility
2. **Security First**: Authentication, rate limiting, and input validation throughout
3. **User Experience**: Fast, responsive, and intuitive interface
4. **Cost Efficiency**: Rate limiting and optimization for AI API calls
5. **Maintainability**: Clear code organization and comprehensive testing

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Next.js React Application                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │   │
│  │  │Dashboard │  │ Project  │  │  Scene   │  │  Quick  │  │   │
│  │  │   View   │  │   View   │  │  Editor  │  │ Create  │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                       Vercel Edge Network                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Next.js API Routes (Serverless)              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │   │
│  │  │  Auth    │  │ Projects │  │  Scenes  │  │   AI    │  │   │
│  │  │  APIs    │  │   APIs   │  │   APIs   │  │  APIs   │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────┬──────────────────────────────┬───────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│    Supabase (PostgreSQL) │    │         OpenAI API           │
│  ┌────────────────────┐  │    │  ┌──────────────────────┐   │
│  │      Users         │  │    │  │     DALL-E 3         │   │
│  │     Projects       │  │    │  │   (Image Gen)        │   │
│  │      Scenes        │  │    │  └──────────────────────┘   │
│  │    Characters      │  │    │  ┌──────────────────────┐   │
│  │       Lore         │  │    │  │    GPT-4o-mini       │   │
│  │    Sequences       │  │    │  │  (Story Expansion)   │   │
│  └────────────────────┘  │    │  └──────────────────────┘   │
│  ┌────────────────────┐  │    └──────────────────────────────┘
│  │   Blob Storage     │  │
│  │  (Scene Images)    │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| Next.js Frontend | UI rendering, client state, routing |
| API Routes | Business logic, validation, orchestration |
| NextAuth.js | Session management, authentication |
| PostgreSQL | Persistent data storage |
| Supabase Storage | Image file storage |
| OpenAI | AI image generation, text expansion |

---

## Data Model

### Entity Relationship Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    User      │     │   Project    │     │    Scene     │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id           │─┐   │ id           │─┐   │ id           │
│ email        │ │   │ userId       │←┘   │ projectId    │←┐
│ name         │ │   │ name         │ │   │ prompt       │ │
│ passwordHash │ └──→│ description  │ │   │ imageUrl     │ │
│ createdAt    │     │ createdAt    │ │   │ style        │ │
└──────────────┘     │ updatedAt    │ │   │ metadata     │ │
                     └──────────────┘ │   │ createdAt    │ │
                            │         │   └──────────────┘ │
                            │         │                    │
                            ▼         │                    │
                     ┌──────────────┐ │   ┌──────────────┐ │
                     │  Character   │ │   │    Lore      │ │
                     ├──────────────┤ │   ├──────────────┤ │
                     │ id           │ │   │ id           │ │
                     │ projectId    │←┘   │ projectId    │←┘
                     │ name         │     │ type         │
                     │ description  │     │ name         │
                     │ traits       │     │ summary      │
                     │ visualDesc   │     │ description  │
                     │ createdAt    │     │ tags         │
                     └──────────────┘     │ createdAt    │
                                          └──────────────┘
```

### Schema Details

#### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Projects
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Scenes
```sql
CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  image_url TEXT,
  url_type VARCHAR(20) DEFAULT 'temporary',
  style VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Authentication

### Flow Diagram

```
┌────────┐     ┌────────┐     ┌──────────┐     ┌────────┐
│ Client │     │NextAuth│     │  bcrypt  │     │   DB   │
└───┬────┘     └───┬────┘     └────┬─────┘     └───┬────┘
    │              │               │               │
    │  Login       │               │               │
    │─────────────>│               │               │
    │              │  Find User    │               │
    │              │───────────────────────────────>│
    │              │               │               │
    │              │  User Data    │               │
    │              │<───────────────────────────────│
    │              │               │               │
    │              │  Compare Hash │               │
    │              │──────────────>│               │
    │              │               │               │
    │              │  Match Result │               │
    │              │<──────────────│               │
    │              │               │               │
    │  JWT Token   │               │               │
    │<─────────────│               │               │
    │              │               │               │
```

### Security Features

| Feature | Implementation |
|---------|----------------|
| Password Hashing | bcrypt with salt rounds |
| Session Storage | JWT in HTTP-only cookies |
| Token Expiry | 30-day session lifetime |
| CSRF Protection | NextAuth built-in |

---

## AI Integration

### Image Generation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Image Generation Flow                     │
└─────────────────────────────────────────────────────────────┘

1. User submits scene prompt
         │
         ▼
2. Rate limit check (20/min)
         │
         ▼
3. Validate prompt content
         │
         ▼
4. Call DALL-E 3 API ──────────────────────┐
         │                                  │
         ▼                                  ▼
5. Receive temporary URL          OpenAI DALL-E 3
         │                         (1024x1024)
         ▼
6. Download image from URL
         │
         ▼
7. Upload to Supabase Storage
         │
         ▼
8. Update scene with permanent URL
         │
         ▼
9. Return result to client
```

### Story Expansion Flow

```
User Prompt: "A detective in a rainy city"
         │
         ▼
┌─────────────────────────────────────────┐
│           GPT-4o-mini Processing         │
│                                          │
│  System Prompt:                          │
│  - Create project name/description       │
│  - Generate N detailed scenes            │
│  - Create 2-4 characters                 │
│  - Build 2-3 lore entries                │
│  - Apply genre/mood constraints          │
│                                          │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│            Structured Output             │
│                                          │
│  {                                       │
│    projectName: "Noir Shadows",          │
│    scenes: [...],                        │
│    characters: [...],                    │
│    lore: [...]                          │
│  }                                       │
└─────────────────────────────────────────┘
```

### Rate Limiting Strategy

| Endpoint | Limit | Rationale |
|----------|-------|-----------|
| `/api/generate-image` | 20/min | Expensive DALL-E calls |
| `/api/expand-story` | 10/hour | Very expensive GPT calls |
| `/api/ai-suggestions` | 30/min | Lightweight GPT calls |

---

## Storage

### Image Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Image Storage Flow                        │
└─────────────────────────────────────────────────────────────┘

DALL-E Generation
       │
       ▼
Temporary URL (expires ~1hr)
       │
       ▼
┌─────────────────────┐
│  Fetch & Download   │
│    Image Buffer     │
└─────────────────────┘
       │
       ▼
┌─────────────────────┐      ┌─────────────────────┐
│  Supabase Storage   │      │    PostgreSQL       │
│  ────────────────   │      │  ───────────────    │
│  /scenes/{sceneId}  │ ───> │  imageUrl: "..."    │
│  /scene.png         │      │  urlType: permanent │
└─────────────────────┘      └─────────────────────┘
```

### Storage Buckets

| Bucket | Purpose | Access |
|--------|---------|--------|
| `scenes` | Generated scene images | Authenticated |
| `exports` | Temporary export files | Authenticated |

---

## Frontend Architecture

### Component Hierarchy

```
App
├── Layout
│   ├── Header
│   │   ├── Logo
│   │   ├── Navigation
│   │   └── UserMenu
│   └── Main Content
│
├── Pages
│   ├── Dashboard (index.tsx)
│   │   ├── HeroSection
│   │   ├── StatsGrid
│   │   ├── ProjectsList
│   │   └── QuickCreateModal
│   │
│   ├── Project View ([projectId].tsx)
│   │   ├── ProjectHeader
│   │   ├── ScenesList
│   │   ├── CharacterManager
│   │   └── LoreManager
│   │
│   └── Scene Editor
│       ├── PromptBuilder
│       ├── StyleSelector
│       └── ImagePreview
│
└── Shared Components
    ├── Modal
    ├── Toast
    ├── LoadingSpinner
    └── ErrorBoundary
```

### State Management

HALCYON-Cinema uses React's built-in state management:

| State Type | Solution |
|------------|----------|
| Local UI State | useState |
| Server State | useEffect + fetch |
| Form State | useState + controlled inputs |
| Global Auth | NextAuth useSession |

### Styling Architecture

```
styles/
├── globals.css          # CSS variables, reset, utilities
├── Home.module.css      # Dashboard styles
└── [Component].module.css  # Component-specific styles

CSS Variables (theme):
├── --color-primary
├── --color-secondary
├── --color-background
├── --color-text
├── --spacing-*
├── --radius-*
└── --shadow-*
```

---

## API Design

### RESTful Conventions

| Operation | HTTP Method | URL Pattern |
|-----------|-------------|-------------|
| List | GET | `/api/resources` |
| Create | POST | `/api/resources` |
| Read | GET | `/api/resources/[id]` |
| Update | PUT | `/api/resources/[id]` |
| Delete | DELETE | `/api/resources/[id]` |

### Response Format

**Success:**
```json
{
  "data": { ... },
  "meta": { "count": 10 }
}
```

**Error:**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Middleware Stack

```
Request
    │
    ▼
┌───────────────┐
│ Rate Limiter  │
└───────────────┘
    │
    ▼
┌───────────────┐
│    Auth       │
│  Middleware   │
└───────────────┘
    │
    ▼
┌───────────────┐
│   Validation  │
└───────────────┘
    │
    ▼
┌───────────────┐
│   Handler     │
└───────────────┘
    │
    ▼
Response
```

---

## Security

### Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     Security Architecture                    │
└─────────────────────────────────────────────────────────────┘

Layer 1: Network
├── HTTPS everywhere
├── Vercel Edge WAF
└── DDoS protection

Layer 2: Application
├── Authentication (NextAuth.js)
├── Rate limiting (per-user, per-endpoint)
├── Input validation (Zod schemas)
└── CSRF protection

Layer 3: Data
├── Password hashing (bcrypt)
├── Parameterized queries (SQL injection prevention)
├── Row-level security (user can only access own data)
└── Constant-time comparisons (timing attack prevention)

Layer 4: Infrastructure
├── Environment variable encryption
├── Secrets management (Vercel)
└── Audit logging
```

### Input Validation

All API inputs are validated using Zod schemas:

```typescript
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
});
```

### URL Security

Special handling for user-provided URLs:
- Recursive URL decoding
- Dangerous scheme detection (javascript:, data:, vbscript:)
- Domain allowlist for external resources

---

## Performance

### Optimization Strategies

| Area | Strategy |
|------|----------|
| Database | Connection pooling, indexed queries |
| Images | Lazy loading, WebP format, CDN caching |
| API | Response caching, pagination |
| Frontend | Code splitting, tree shaking |
| AI | Request batching, result caching |

### Caching Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      Caching Layers                          │
└─────────────────────────────────────────────────────────────┘

Browser Cache
├── Static assets (long TTL)
├── API responses (short TTL via headers)
└── Service Worker (offline support - future)

CDN Cache (Vercel Edge)
├── Static pages
├── Incremental Static Regeneration
└── Image optimization

Application Cache
├── Rate limiter state (in-memory)
└── Session cache (JWT)

Database
├── Query result caching (Supabase)
└── Connection pooling
```

---

## Testing Strategy

### Test Pyramid

```
              ┌───────────────┐
             /   E2E Tests     \      <- Browser automation
            /   (Playwright)    \
           /─────────────────────\
          /   Integration Tests   \    <- API testing
         /      (Vitest)           \
        /───────────────────────────\
       /      Unit Tests             \  <- Component/function
      /        (Vitest)               \
     /─────────────────────────────────\
```

### Test Categories

| Category | Location | Purpose |
|----------|----------|---------|
| E2E | `tests/e2e/` | API endpoint testing |
| Journeys | `tests/journeys/` | User flow testing |
| Unit | `tests/unit/` | Function/component testing |

### CI Pipeline

```yaml
Trigger: Push to main/PR
    │
    ├── Lint (ESLint)
    │
    ├── Type Check (TypeScript)
    │
    ├── Test (Vitest + PostgreSQL)
    │
    ├── Build (Next.js)
    │
    ├── Security Audit (npm audit)
    │
    └── Bundle Analysis
```

---

## Deployment

### Vercel Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Platform                           │
└─────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   Static    │ │  Serverless │ │    Edge     │
    │   Assets    │ │  Functions  │ │  Functions  │
    │   (CDN)     │ │  (API)      │ │  (Future)   │
    └─────────────┘ └─────────────┘ └─────────────┘
```

### Environment Configuration

| Environment | Purpose | Branch |
|-------------|---------|--------|
| Development | Local development | - |
| Preview | PR previews | feature/* |
| Production | Live application | main |

### Deployment Checklist

1. [ ] All tests pass
2. [ ] No TypeScript errors
3. [ ] No ESLint errors
4. [ ] Environment variables configured
5. [ ] Database migrations applied
6. [ ] Bundle size within limits

---

## Future Considerations

### Scalability Path

1. **Database**: Read replicas, sharding by user
2. **Caching**: Redis for session/rate limit state
3. **Queues**: Background job processing for AI
4. **CDN**: More aggressive image caching
5. **Microservices**: Extract AI service if needed

### Planned Features

- [ ] Real-time collaboration
- [ ] Video generation
- [ ] Custom AI model fine-tuning
- [ ] Mobile application
- [ ] Plugin system

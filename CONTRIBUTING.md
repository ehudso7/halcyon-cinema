# Contributing to HALCYON-Cinema

Thank you for your interest in contributing to HALCYON-Cinema! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect all contributors to:

- Be respectful and considerate in all interactions
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Accept responsibility for mistakes and learn from them

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js >= 20.0.0
- npm or yarn
- Git
- A GitHub account
- PostgreSQL (for local development)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/halcyon-cinema.git
cd halcyon-cinema
```

3. Add the upstream remote:

```bash
git remote add upstream https://github.com/ehudso7/halcyon-cinema.git
```

## Development Setup

### Install Dependencies

```bash
npm install
```

### Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

Required environment variables:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/halcyon
NEXTAUTH_SECRET=your-development-secret
NEXTAUTH_URL=http://localhost:3000
OPENAI_API_KEY=sk-your-api-key  # Optional for UI development
```

### Database Setup

If you're working with database features:

```bash
# Start PostgreSQL locally or use Supabase
# The schema will be auto-created on first run
```

### Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## How to Contribute

### Types of Contributions

We welcome various types of contributions:

| Type | Description |
|------|-------------|
| **Bug Fixes** | Fix reported issues or bugs you discover |
| **Features** | Implement new features (discuss first in an issue) |
| **Documentation** | Improve or add documentation |
| **Tests** | Add or improve test coverage |
| **Performance** | Optimize performance bottlenecks |
| **Accessibility** | Improve accessibility (a11y) |
| **Refactoring** | Code improvements without changing behavior |

### Workflow

1. **Check existing issues** - Look for related issues before creating new ones
2. **Create/claim an issue** - For significant changes, create or comment on an issue first
3. **Create a branch** - Branch from `main` with a descriptive name
4. **Make changes** - Follow our coding standards
5. **Write tests** - Add tests for new functionality
6. **Submit PR** - Create a pull request with a clear description

### Branch Naming

Use descriptive branch names:

```
feature/quick-create-modal
fix/auth-session-timeout
docs/api-documentation
refactor/scene-component
test/character-e2e
```

## Pull Request Process

### Before Submitting

1. **Update from upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**:
   ```bash
   npm run lint          # ESLint
   npx tsc --noEmit      # TypeScript
   npm test              # Tests
   ```

3. **Test your changes** manually in the browser

### PR Requirements

- [ ] Code follows project style guidelines
- [ ] All tests pass
- [ ] New functionality includes tests
- [ ] Documentation updated (if applicable)
- [ ] No new TypeScript errors or warnings
- [ ] No new ESLint errors or warnings
- [ ] Commit messages are clear and descriptive

### PR Description

Use our [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md) which includes:

- Summary of changes
- Type of change (bug fix, feature, etc.)
- Testing performed
- Screenshots (for UI changes)

### Review Process

1. Automated checks run (lint, typecheck, tests, build)
2. CodeRabbit AI reviews the code
3. Maintainer reviews and provides feedback
4. Address any requested changes
5. Once approved, maintainer merges the PR

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types (avoid `any`)
- Use interfaces for object shapes
- Export types that are used across files

```typescript
// Good
interface ProjectData {
  id: string;
  name: string;
  description?: string;
}

// Avoid
const project: any = { ... };
```

### React Components

- Use functional components with hooks
- Keep components focused and small
- Extract reusable logic into custom hooks
- Use CSS Modules for styling

```typescript
// Good
export default function ProjectCard({ project }: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  // ...
}
```

### API Routes

- Use proper HTTP methods (GET, POST, PUT, DELETE)
- Validate input data
- Return appropriate status codes
- Handle errors gracefully

```typescript
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // ...
}
```

### File Organization

```
src/
├── components/           # React components
│   ├── ComponentName.tsx
│   └── ComponentName.module.css
├── pages/
│   ├── api/             # API routes
│   └── [page].tsx       # Page components
├── utils/               # Utility functions
├── types/               # TypeScript types
└── styles/              # Global styles
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `ProjectCard.tsx` |
| Hooks | camelCase with `use` prefix | `useProjects.ts` |
| Utilities | camelCase | `formatDate.ts` |
| CSS Modules | camelCase | `styles.projectCard` |
| Constants | UPPER_SNAKE_CASE | `MAX_SCENES` |
| Types/Interfaces | PascalCase | `ProjectData` |

## Testing Guidelines

### Test Structure

```
tests/
├── e2e/                 # End-to-end API tests
│   ├── project-e2e.spec.ts
│   ├── scene-e2e.spec.ts
│   └── auth-e2e.spec.ts
└── journeys/            # User journey tests
    └── create_project.spec.ts
```

### Writing Tests

Use Vitest for testing:

```typescript
import { describe, it, expect } from 'vitest';

describe('ProjectService', () => {
  it('should create a new project', async () => {
    const result = await createProject({ name: 'Test' });
    expect(result).toBeDefined();
    expect(result.name).toBe('Test');
  });
});
```

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- tests/e2e/project-e2e.spec.ts

# Watch mode
npm test -- --watch

# With coverage
npm run test:coverage
```

### Test Coverage

- Aim for meaningful test coverage
- Cover happy paths and error cases
- Test edge cases and boundary conditions
- Don't write tests just for coverage numbers

## Documentation

### Code Comments

- Write self-documenting code
- Add comments for complex logic
- Use JSDoc for public APIs

```typescript
/**
 * Expands a story prompt into a full project structure using AI.
 * @param prompt - The user's story idea
 * @param options - Generation options (genre, mood, sceneCount)
 * @returns Generated project data including scenes, characters, and lore
 */
export async function expandStory(prompt: string, options: StoryOptions): Promise<StoryData> {
  // ...
}
```

### README Updates

Update documentation when:

- Adding new features
- Changing configuration
- Modifying the API
- Adding dependencies

### API Documentation

Document new API endpoints in `docs/API.md`:

```markdown
### POST /api/your-endpoint

Description of what it does.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| field1 | string | Yes | Description |

**Response:**
| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Operation result |
```

## Questions?

- Open a [GitHub Discussion](https://github.com/ehudso7/halcyon-cinema/discussions) for questions
- Check existing issues and discussions first
- Be specific and provide context

## Thank You!

Your contributions make HALCYON-Cinema better for everyone. We appreciate your time and effort!

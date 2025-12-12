<p align="center">
  <img src="public/logo.svg" alt="HALCYON-Cinema Logo" width="120" height="120" />
</p>

<h1 align="center">HALCYON-Cinema</h1>

<p align="center">
  <strong>AI-Powered Cinematic Content Studio</strong>
</p>

<p align="center">
  Build scenes, storyboards, artworks, and cinematic media from natural-language prompts
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.5.0-blue.svg" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg" alt="Node Version" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" />
</p>

---

## Overview

HALCYON-Cinema is a full-stack AI-powered creative studio that transforms natural language into stunning cinematic visuals. Whether you're a filmmaker, game designer, writer, or creative professional, HALCYON-Cinema helps you visualize your stories with AI-generated scenes, characters, and storyboards.

### Why HALCYON-Cinema?

- **Single-Prompt Creation**: Generate complete projects with characters, scenes, and lore from one idea
- **Professional Quality**: Powered by DALL-E 3 for cinematic-quality image generation
- **Organized Workflow**: Projects, scenes, characters, and lore management built-in
- **Export Ready**: Download as PDF storyboards or ZIP archives with all assets

## Features

### Quick Create (New!)
Generate a complete cinematic project from a single prompt - like Suno for visual storytelling:
- AI expands your idea into multiple scenes
- Auto-generates characters with visual descriptions
- Creates world lore (locations, events, systems)
- Applies consistent visual style across all content

### Core Features

| Feature | Description |
|---------|-------------|
| **Scene Generation** | Create AI-powered visuals from natural language descriptions |
| **Project Management** | Organize scenes into projects with full CRUD operations |
| **Character System** | Define characters with traits, descriptions, and visual references |
| **World Lore** | Build rich world backgrounds with locations, events, and systems |
| **Sequences** | Arrange scenes into ordered sequences for storyboarding |
| **Multiple Export Formats** | PDF storyboards, ZIP archives, individual images |
| **12+ Visual Styles** | Cinematic Realism, Film Noir, Anime, Sci-Fi, Fantasy, and more |
| **AI Suggestions** | Get intelligent enhancements for your scene prompts |

### Authentication & Security
- Secure user authentication with NextAuth.js
- bcrypt password hashing
- JWT session management
- Rate limiting on AI endpoints
- HMAC-based constant-time token comparison

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Next.js 16](https://nextjs.org/) (React 19) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Authentication** | [NextAuth.js](https://next-auth.js.org/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) via [Supabase](https://supabase.com/) |
| **AI/ML** | [OpenAI API](https://openai.com/) (DALL-E 3, GPT-4o-mini) |
| **Styling** | CSS Modules |
| **Testing** | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) |
| **Deployment** | [Vercel](https://vercel.com/) |
| **CI/CD** | GitHub Actions |

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- npm or yarn
- PostgreSQL database (or Supabase account)
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/ehudso7/halcyon-cinema.git
cd halcyon-cinema

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Configuration

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/halcyon

# Authentication
NEXTAUTH_SECRET=your-secure-random-string
NEXTAUTH_URL=http://localhost:3000

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Supabase (optional, for cloud storage)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Running Locally

```bash
# Start development server
npm run dev

# Open in browser
open http://localhost:3000
```

### Running Tests

```bash
# Run all tests
npm test

# Run E2E tests
npm run test:e2e

# Run journey tests
npm run test:journeys

# Run with coverage
npm run test:coverage
```

### Building for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Project Structure

```
halcyon-cinema/
├── .github/                 # GitHub Actions workflows & templates
│   ├── workflows/
│   │   └── ci.yml          # CI pipeline (lint, test, build)
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/                    # Documentation
│   ├── API.md              # API reference
│   └── ARCHITECTURE.md     # System architecture
├── public/                  # Static assets
├── src/
│   ├── components/         # React components
│   │   ├── Header.tsx
│   │   ├── ProjectCard.tsx
│   │   ├── CreateProjectModal.tsx
│   │   ├── QuickCreateModal.tsx
│   │   └── ...
│   ├── pages/              # Next.js pages
│   │   ├── api/            # API routes
│   │   │   ├── auth/       # Authentication endpoints
│   │   │   ├── projects/   # Project CRUD
│   │   │   ├── scenes/     # Scene management
│   │   │   ├── characters/ # Character endpoints
│   │   │   ├── expand-story.ts  # AI story expansion
│   │   │   └── generate-image.ts # Image generation
│   │   ├── project/        # Project pages
│   │   └── auth/           # Auth pages
│   ├── styles/             # CSS Modules
│   ├── types/              # TypeScript definitions
│   └── utils/              # Utility functions
├── tests/
│   ├── e2e/               # End-to-end tests
│   └── journeys/          # User journey tests
├── CHANGELOG.md           # Version history
├── CONTRIBUTING.md        # Contribution guidelines
├── LICENSE                # MIT License
└── README.md             # This file
```

## API Overview

HALCYON-Cinema provides a comprehensive REST API:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET, POST | List/create projects |
| `/api/projects/[id]` | GET, PUT, DELETE | Manage specific project |
| `/api/scenes` | GET, POST | List/create scenes |
| `/api/scenes/[id]` | GET, PUT, DELETE | Manage specific scene |
| `/api/generate-image` | POST | Generate AI image |
| `/api/expand-story` | POST | AI story expansion |
| `/api/ai-suggestions` | POST | Get prompt suggestions |
| `/api/export/project/[id]` | GET | Export project as ZIP |
| `/api/export/scene/[id]` | GET | Export scene as PDF |

See [docs/API.md](docs/API.md) for complete API documentation.

## Documentation

- [API Reference](docs/API.md) - Complete API documentation
- [Architecture](docs/ARCHITECTURE.md) - System design and architecture
- [Contributing](CONTRIBUTING.md) - How to contribute
- [Changelog](CHANGELOG.md) - Version history

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Configure environment variables in Vercel dashboard
4. Deploy automatically on every push

### Docker

```bash
# Build the image
docker build -t halcyon-cinema .

# Run the container
docker run -p 3000:3000 --env-file .env.local halcyon-cinema
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit with a descriptive message
6. Push to your fork
7. Open a Pull Request

## Security

- Report security vulnerabilities to security@halcyon-cinema.dev
- See [SECURITY.md](SECURITY.md) for our security policy
- All AI endpoints are rate-limited
- Authentication required for all data operations

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [OpenAI](https://openai.com/) for DALL-E and GPT APIs
- [Vercel](https://vercel.com/) for hosting and deployment
- [Supabase](https://supabase.com/) for database and storage
- All our [contributors](https://github.com/ehudso7/halcyon-cinema/contributors)

---

<p align="center">
  Made with creativity and AI
</p>

<p align="center">
  <a href="https://github.com/ehudso7/halcyon-cinema/stargazers">Star this repo</a> •
  <a href="https://github.com/ehudso7/halcyon-cinema/issues">Report Bug</a> •
  <a href="https://github.com/ehudso7/halcyon-cinema/issues">Request Feature</a>
</p>

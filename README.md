<p align="center">
  <img src="public/logo.svg" alt="HALCYON-Cinema Logo" width="120" height="120" />
</p>

<h1 align="center">HALCYON-Cinema</h1>

<p align="center">
  <strong>AI-Powered Cinematic Content Studio</strong>
</p>

<p align="center">
  Transform your stories into stunning visual narratives with AI-generated scenes, characters, and multimedia content
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

HALCYON-Cinema is a full-stack AI-powered creative studio that transforms natural language into cinematic visuals and multimedia content. Whether you're a filmmaker, game designer, writer, or creative professional, HALCYON-Cinema helps you visualize your stories with AI-generated scenes, characters, videos, music, and storyboards.

### Why HALCYON-Cinema?

- **Single-Prompt Creation**: Generate complete projects with characters, scenes, and world lore from one idea
- **Multi-Modal AI**: Images, videos, music, and voiceovers powered by cutting-edge AI
- **Literary Adaptation**: Import novels and scripts, auto-detect chapters, and visualize your stories
- **Professional Workflow**: Projects, scenes, characters, lore, and sequence management
- **Export Ready**: Download as PDF storyboards or ZIP archives with all assets

---

## Features

### Quick Create
Generate a complete cinematic project from a single prompt:
- AI expands your idea into multiple scenes with detailed prompts
- Auto-generates characters with traits and visual descriptions
- Creates world lore (locations, events, systems)
- Applies consistent visual style across all content
- Choose from 10 genres and 10 mood presets

### AI Generation Suite

| Feature | Description | Powered By |
|---------|-------------|------------|
| **Image Generation** | Cinematic-quality visuals from text prompts | DALL-E 3 |
| **Video Generation** | Transform static scenes into motion | Replicate |
| **Music Generation** | AI-composed soundtracks for your scenes | Replicate |
| **Voiceover** | AI-generated narration and dialogue | OpenAI TTS |
| **Story Expansion** | Expand prompts into full narratives | GPT-4o-mini |
| **AI Suggestions** | Intelligent prompt enhancements | GPT-4o-mini |

### Literary Adaptation Mode
Transform written works into visual storyboards:
- Import documents (PDF, DOCX, TXT)
- Automatic chapter detection
- Prose sanitization for scene generation
- Chapter-by-chapter visualization

### Content Management

| Feature | Description |
|---------|-------------|
| **Projects** | Organize all your creative work with full CRUD operations |
| **Scenes** | Create and manage AI-powered visuals with notes and metadata |
| **Characters** | Define characters with traits, descriptions, and visual references |
| **World Lore** | Build rich backgrounds with locations, events, and systems |
| **Sequences** | Arrange scenes into ordered storyboards with drag-and-drop |
| **12+ Visual Styles** | Cinematic Realism, Film Noir, Anime, Sci-Fi, Fantasy, and more |

### Export & Sharing
- PDF storyboard export with scene details
- ZIP archives with all project assets
- Public sharing links for collaboration
- Individual scene exports

### Authentication & Security
- Secure email/password authentication
- Google OAuth integration
- GitHub OAuth integration
- Password reset via email
- bcrypt password hashing
- JWT session management
- Rate limiting on AI endpoints

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Next.js 16](https://nextjs.org/) with [React 19](https://react.dev/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Authentication** | [NextAuth.js](https://next-auth.js.org/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) via [Supabase](https://supabase.com/) |
| **Storage** | [Supabase Storage](https://supabase.com/storage) |
| **AI/ML** | [OpenAI](https://openai.com/) (DALL-E 3, GPT-4o-mini, TTS) |
| **Video/Music** | [Replicate](https://replicate.com/) |
| **Payments** | [Stripe](https://stripe.com/) |
| **Styling** | CSS Modules |
| **Testing** | [Vitest](https://vitest.dev/) |
| **Deployment** | [Vercel](https://vercel.com/) |

---

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- npm or yarn
- PostgreSQL database (or [Supabase](https://supabase.com/) account)
- [OpenAI API key](https://platform.openai.com/api-keys)

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

Create a `.env.local` file with the required variables:

```env
# Authentication (Required)
NEXTAUTH_SECRET=your-secure-random-string
NEXTAUTH_URL=http://localhost:3000

# Database (Required)
POSTGRES_URL=postgresql://user:password@localhost:5432/halcyon

# Supabase (Required for storage)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (Required for AI features)
OPENAI_API_KEY=sk-your-openai-api-key

# Replicate (Optional - for video/music generation)
REPLICATE_API_TOKEN=your-replicate-token

# Google OAuth (Optional - for social login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth (Optional - for social login)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Stripe (Optional - for payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

See `.env.example` for the complete list of configuration options.

### OAuth Configuration

For Google and GitHub OAuth to work correctly, you must configure redirect URIs in their respective developer consoles:

**Google Cloud Console:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services > Credentials
3. Add these authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-domain.com/api/auth/callback/google` (production)
   - `https://your-app.vercel.app/api/auth/callback/google` (Vercel preview)

**GitHub Developer Settings:**
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create or select your OAuth App
3. Set the Authorization callback URL:
   - `http://localhost:3000/api/auth/callback/github` (development)
   - `https://your-domain.com/api/auth/callback/github` (production)

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

---

## Project Structure

```plaintext
halcyon-cinema/
├── .github/                 # GitHub Actions workflows
├── docs/                    # Documentation
│   ├── API.md              # API reference
│   └── ARCHITECTURE.md     # System architecture
├── public/                  # Static assets
├── src/
│   ├── components/         # React components
│   ├── pages/              # Next.js pages
│   │   ├── api/            # API routes
│   │   │   ├── auth/       # Authentication
│   │   │   ├── projects/   # Project management
│   │   │   ├── scenes/     # Scene operations
│   │   │   ├── characters/ # Character management
│   │   │   ├── import/     # Document import
│   │   │   ├── payments/   # Stripe integration
│   │   │   ├── generate-image.ts
│   │   │   ├── generate-video.ts
│   │   │   ├── generate-music.ts
│   │   │   └── generate-voiceover.ts
│   │   ├── project/        # Project pages
│   │   └── auth/           # Auth pages
│   ├── styles/             # CSS Modules
│   ├── types/              # TypeScript definitions
│   └── utils/              # Utility functions
├── tests/                   # Test suites
├── CHANGELOG.md            # Version history
├── CONTRIBUTING.md         # Contribution guide
└── README.md               # This file
```

---

## API Overview

HALCYON-Cinema provides a comprehensive REST API:

### Core Resources

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/projects` | GET, POST | List and create projects |
| `/api/projects/[id]` | GET, PUT, DELETE | Manage projects |
| `/api/scenes` | GET, POST | List and create scenes |
| `/api/scenes/[id]` | GET, PUT, DELETE | Manage scenes |
| `/api/projects/[id]/characters` | GET, POST | Character management |
| `/api/projects/[id]/lore` | GET, POST | World lore management |
| `/api/projects/[id]/sequences` | GET, POST | Sequence management |

### AI Generation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate-image` | POST | Generate scene images |
| `/api/generate-video` | POST | Generate scene videos |
| `/api/generate-music` | POST | Generate background music |
| `/api/generate-voiceover` | POST | Generate voiceover audio |
| `/api/expand-story` | POST | AI story expansion |
| `/api/ai-suggestions` | POST | Prompt suggestions |

### Import & Export

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/import/upload` | POST | Upload documents |
| `/api/import/detect-chapters` | POST | Detect chapters |
| `/api/import/analyze` | POST | Analyze content |
| `/api/export/project/[id]` | GET | Export as ZIP |
| `/api/export/scene/[id]` | GET | Export as PDF |

See [docs/API.md](docs/API.md) for complete API documentation.

---

## Documentation

- [API Reference](docs/API.md) - Complete API documentation
- [Architecture](docs/ARCHITECTURE.md) - System design and architecture
- [Contributing](CONTRIBUTING.md) - How to contribute
- [Changelog](CHANGELOG.md) - Version history

---

## Troubleshooting

### OAuth Errors

**Error: `redirect_uri_mismatch`**

This error occurs when the redirect URI in your OAuth request doesn't match what's registered in the provider's console.

**Solution:**
1. Check the error message for the exact redirect URI being used
2. Add that exact URI to your OAuth provider's authorized redirect URIs
3. For Vercel deployments, add both your production domain and preview URLs
4. Make sure `NEXTAUTH_URL` is set correctly in your environment variables

### OAuth Buttons Not Appearing

If OAuth buttons don't appear on the sign-in page, the provider credentials are not configured.

**Solution:**
1. Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set for Google
2. Ensure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set for GitHub
3. Restart your development server after adding environment variables

### Mobile Layout Issues

The app is optimized for mobile browsers with:
- Touch-friendly button sizes (minimum 44px tap targets)
- Bottom sheet modals for better mobile UX
- Safe area insets for notched devices
- iOS zoom prevention on form inputs

---

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Connect Supabase via the Storage integration
4. Configure remaining environment variables
5. Deploy automatically on every push

### Docker

```bash
# Build the image
docker build -t halcyon-cinema .

# Run the container
docker run -p 3000:3000 --env-file .env.local halcyon-cinema
```

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit with a descriptive message
6. Push to your fork
7. Open a Pull Request

---

## Security

- Report security vulnerabilities to `security@halcyon-cinema.dev`
- See [SECURITY.md](SECURITY.md) for our security policy

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [OpenAI](https://openai.com/) for DALL-E, GPT, and TTS APIs
- [Replicate](https://replicate.com/) for video and music generation
- [Vercel](https://vercel.com/) for hosting and deployment
- [Supabase](https://supabase.com/) for database and storage
- [Stripe](https://stripe.com/) for payment processing

---

<p align="center">
  Made with creativity and AI
</p>

<p align="center">
  <a href="https://github.com/ehudso7/halcyon-cinema/stargazers">Star this repo</a> •
  <a href="https://github.com/ehudso7/halcyon-cinema/issues">Report Bug</a> •
  <a href="https://github.com/ehudso7/halcyon-cinema/issues">Request Feature</a>
</p>

# HALCYON-Cinema

An AI-powered cinematic content studio: build scenes, storyboards, artworks, and cinematic media from natural-language prompts.

## What it does (MVP v1.0)

- Let user input natural-language "scene prompts" or use UI builder
- Generate AI visuals (via DALL-E or similar) from prompts
- Store and organize projects / scenes
- Present a "gallery / storyboard" of generated scenes
- Allow export (e.g. ZIP / PDF) of prompt + images

## Tech Stack

- **Frontend / UI & routing**: Next.js (React-based)
- **Hosting / deployment**: Vercel — auto-deploy from GitHub repo
- **Backend / API + image generation logic**: Node (via Next.js built-in API or route handlers), calling image-generation API (e.g. DALL-E)
- **Version control**: GitHub

## Folder Structure

```
halcyon-cinema/
├── public/                  # static assets (if any)
├── src/                     # main source code
│   ├── components/          # UI components (PromptBuilder, Gallery, etc.)
│   ├── pages/               # Next.js pages (or app/ if using app-router)
│   ├── api/                 # API routes for backend calls (image generation, project CRUD, etc.)
│   ├── utils/               # utility/helper functions (prompt formatting, API wrappers, etc.)
│   ├── styles/              # global and component CSS / styling
│   └── data/                # store metadata / local DB or JSON storage
├── .env.local               # local environment variables (e.g. API keys) — NOT committed
├── .gitignore
├── package.json             # dependencies & scripts
├── README.md                # this file
└── vercel.json / config     # custom Vercel config
```

## Environment Variables

Use `.env.local` for secrets and configuration (do **not** commit this file). Example variables:

```
OPENAI_API_KEY=your_openai_or_dalle_key
NEXT_PUBLIC_API_BASE_URL=https://api.your-backend.com   # if needed
```

If you need to access a variable from client-side code, prefix it with `NEXT_PUBLIC_`.

When deploying with Vercel — go to your project settings → "Environment Variables", add the same variables there so they become available in production.

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env.local` and add your OpenAI API key
3. Install dependencies: `npm install`
4. Run development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

## Deployment

1. `git init`, commit code, push to GitHub
2. Link repository to Vercel → Vercel auto-detects Next.js and configures defaults
3. Add environment variables in Vercel project settings
4. On each push (to main or branches), Vercel triggers automatic deployment
5. Enjoy live previews + production deployments

## License

MIT

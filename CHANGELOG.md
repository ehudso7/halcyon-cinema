# Changelog

All notable changes to HALCYON-Cinema will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2024-12-12

### Added

- **Quick Create Feature**: Generate complete cinematic projects from a single prompt
  - AI-powered story expansion using GPT-4o-mini
  - Auto-generates project name, description, and visual style
  - Creates 3-10 scenes with detailed prompts
  - Generates 2-4 characters with traits and visual descriptions
  - Creates world lore entries (locations, events, systems)
  - Genre selector with 10 options (Cinematic Realism, Film Noir, Sci-Fi, etc.)
  - Mood selector with 10 options (Epic, Mysterious, Romantic, etc.)
  - Scene count slider for customization
- Keyboard shortcut `Q` for Quick Create modal
- Dynamic max tokens based on scene count (2500-4000)
- Rate limiting for story expansion API (10 requests/hour per user)
- Enhanced AI response validation (validates scene, character, lore structure)
- Partial failure handling with user feedback

### Changed

- Updated hero section with Quick Create as primary CTA
- Improved error handling for parallel API calls using `Promise.allSettled`
- Minimum prompt length increased from 10 to 20 characters

### Security

- Added rate limiting to `/api/expand-story` endpoint

## [1.4.0] - 2024-12-11

### Added

- Storage health endpoint (`/api/storage-health`) for debugging Supabase configuration
- Image expiration handling with "Image Expired" message display
- Credits display and validation in PromptBuilder
- Credits tracking system with persistence warnings
- Content type selection (Image/Video)
- Shared Warning component for consistent UI

### Changed

- Improved image URL handling with temporary URL support
- Enhanced storage configuration debugging capabilities

### Security

- HMAC-based constant-time comparison for token validation
- Rate-limited warning logs to prevent log spam
- Production access gating for storage-health endpoint

## [1.3.0] - 2024-12-10

### Added

- Image persistence to Supabase Storage
- Automatic image upload when generating scenes
- URL type tracking (permanent vs temporary)

### Fixed

- Image URL expiration issue - images now persist indefinitely
- DALL-E temporary URL handling

### Security

- Recursive URL decoding to prevent multi-layer encoding bypass
- Re-validation of decoded URL structure
- Expanded dangerous URL scheme detection
- Prevention of URL encoding bypass attacks

## [1.2.0] - 2024-12-09

### Added

- World lore system
  - Location entries with descriptions
  - Event entries for timeline
  - System entries for world rules
  - Lore tagging and filtering
- Lore API endpoints (CRUD operations)
- Lore management UI in project view
- E2E tests for lore functionality

### Changed

- Project detail page layout to include lore section
- Enhanced project data model with lore relationships

## [1.1.0] - 2024-12-08

### Added

- Character management system
  - Character creation with traits
  - Visual descriptions for image generation
  - Character-scene associations
- Character API endpoints (CRUD operations)
- Character management UI component
- Sequence/storyboard feature
  - Scene ordering within sequences
  - Drag-and-drop reordering
  - Multiple sequences per project
- Sequence API endpoints
- E2E tests for characters and sequences

### Changed

- Project structure to support characters
- Scene generation to include character context

## [1.0.0] - 2024-12-07

### Added

- Initial release of HALCYON-Cinema
- User authentication with NextAuth.js
  - Email/password registration
  - Secure login with JWT sessions
  - Password change functionality
  - Account deletion with data export
- Project management
  - Create, read, update, delete projects
  - Project descriptions and metadata
- Scene generation
  - Natural language prompt input
  - AI image generation via DALL-E 3
  - 12+ visual style presets
  - Metadata storage (shot type, mood, lighting)
- AI suggestions for prompt enhancement
- Export functionality
  - PDF storyboard export
  - ZIP archive with all assets
  - Individual scene export
- Dashboard with statistics
- Keyboard shortcuts for power users
- Responsive design for all screen sizes
- Comprehensive E2E test suite (200+ tests)
- CI/CD pipeline with GitHub Actions
  - Automated linting
  - TypeScript type checking
  - Test execution
  - Build verification
  - Security audit
  - Bundle size analysis

### Security

- bcrypt password hashing
- JWT session management
- Rate limiting on AI endpoints
- Input validation and sanitization
- CSRF protection

## [0.1.0] - 2024-12-01

### Added

- Project scaffolding
- Next.js 16 setup with TypeScript
- PostgreSQL database integration
- Basic authentication flow
- Initial UI components

---

## Release Notes Format

Each release includes:

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Features to be removed in future releases
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security-related changes

## Versioning

HALCYON-Cinema uses [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features (backward compatible)
- **PATCH** (0.0.X): Bug fixes (backward compatible)

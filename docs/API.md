# HALCYON-Cinema API Reference

Complete API documentation for HALCYON-Cinema.

## Table of Contents

- [Authentication](#authentication)
- [Projects](#projects)
- [Scenes](#scenes)
- [Characters](#characters)
- [Lore](#lore)
- [Sequences](#sequences)
- [AI Generation](#ai-generation)
- [Import](#import)
- [Export](#export)
- [Payments](#payments)
- [Health & Status](#health--status)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Authentication

All API endpoints (except health checks) require authentication. HALCYON-Cinema uses NextAuth.js with JWT sessions.

### Headers

Include the session cookie in all requests:

```
Cookie: next-auth.session-token=<token>
```

### Auth Endpoints

#### POST /api/auth/register

Create a new user account.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Display name (2-50 chars) |
| email | string | Yes | Valid email address |
| password | string | Yes | Password (8+ chars) |

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### POST /api/auth/callback/credentials

Sign in with email and password.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Email address |
| password | string | Yes | Password |

#### POST /api/auth/change-password

Change the current user's password.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| currentPassword | string | Yes | Current password |
| newPassword | string | Yes | New password (8+ chars) |

#### POST /api/auth/forgot-password

Request a password reset email.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Account email address |

#### POST /api/auth/reset-password

Reset password using a reset token.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| token | string | Yes | Reset token from email |
| password | string | Yes | New password (8+ chars) |

#### PUT /api/auth/update-profile

Update user profile information.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | No | New display name |
| email | string | No | New email address |

#### GET /api/auth/export-data

Export all user data (GDPR compliance).

**Response (200 OK):**
```json
{
  "user": { ... },
  "projects": [ ... ],
  "scenes": [ ... ],
  "characters": [ ... ],
  "lore": [ ... ]
}
```

#### DELETE /api/auth/delete-account

Permanently delete the user account and all associated data.

---

## Projects

Manage cinematic projects.

### GET /api/projects

List all projects for the authenticated user.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| sort | string | "updatedAt" | Sort field |
| order | string | "desc" | Sort order (asc/desc) |
| limit | number | 50 | Max results |

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "name": "My Project",
    "description": "A cinematic story...",
    "userId": "uuid",
    "mode": "standard",
    "createdAt": "2024-12-01T00:00:00Z",
    "updatedAt": "2024-12-01T00:00:00Z",
    "scenes": [],
    "characters": [],
    "lore": []
  }
]
```

### POST /api/projects

Create a new project.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Project name (1-100 chars) |
| description | string | No | Project description |
| mode | string | No | Project mode (standard/literary) |

### GET /api/projects/[projectId]

Get a specific project with all related data.

### PUT /api/projects/[projectId]

Update a project.

### DELETE /api/projects/[projectId]

Delete a project and all associated data.

### PUT /api/projects/[projectId]/mode

Update project mode (standard or literary adaptation).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| mode | string | Yes | "standard" or "literary" |

---

## Scenes

Manage scenes within projects.

### GET /api/scenes

List scenes, optionally filtered by project.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | No | Filter by project |

### POST /api/scenes

Create a new scene.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| projectId | string | Yes | Parent project ID |
| prompt | string | Yes | Scene description |
| imageUrl | string | No | Generated image URL |
| notes | string | No | User notes |
| metadata | object | No | Additional metadata |

**Metadata Object:**
| Field | Type | Description |
|-------|------|-------------|
| shotType | string | Wide Shot, Close-up, etc. |
| mood | string | Epic, Mysterious, etc. |
| lighting | string | Natural, Golden Hour, etc. |
| style | string | Visual style |
| aspectRatio | string | Image aspect ratio |
| mediaType | string | "image" or "video" |

### GET /api/scenes/[id]

Get a specific scene.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID for authorization |

### PUT /api/scenes/[id]

Update a scene.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID for authorization |

### DELETE /api/scenes/[id]

Delete a scene.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID for authorization |

---

## Characters

Manage characters within projects.

### GET /api/projects/[projectId]/characters

List all characters in a project.

### POST /api/projects/[projectId]/characters

Create a new character.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Character name |
| description | string | No | Personality/role description |
| traits | string[] | No | Character traits |
| imageUrl | string | No | Character image URL |

### GET /api/projects/[projectId]/characters/[characterId]

Get a specific character.

### PUT /api/projects/[projectId]/characters/[characterId]

Update a character.

### DELETE /api/projects/[projectId]/characters/[characterId]

Delete a character.

---

## Lore

Manage world-building lore entries.

### GET /api/projects/[projectId]/lore

List all lore entries in a project.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Filter by type (location/event/system) |

### POST /api/projects/[projectId]/lore

Create a new lore entry.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | location, event, or system |
| name | string | Yes | Lore entry name |
| summary | string | No | Brief summary |
| description | string | No | Full description |
| tags | string[] | No | Categorization tags |
| imageUrl | string | No | Lore image URL |

### GET /api/projects/[projectId]/lore/[loreId]

Get a specific lore entry.

### PUT /api/projects/[projectId]/lore/[loreId]

Update a lore entry.

### DELETE /api/projects/[projectId]/lore/[loreId]

Delete a lore entry.

---

## Sequences

Manage scene sequences for storyboarding.

### GET /api/projects/[projectId]/sequences

List all sequences in a project.

### POST /api/projects/[projectId]/sequences

Create a new sequence.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Sequence name |
| description | string | No | Sequence description |
| shots | object[] | No | Ordered shot blocks |

### PUT /api/projects/[projectId]/sequences/[sequenceId]

Update a sequence (including shot order).

### DELETE /api/projects/[projectId]/sequences/[sequenceId]

Delete a sequence.

---

## AI Generation

### POST /api/generate-image

Generate an AI image for a scene.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sceneId | string | Yes | Scene to generate for |
| projectId | string | Yes | Project ID |
| prompt | string | Yes | Image description |
| style | string | No | Visual style preset |

**Response (200 OK):**
```json
{
  "success": true,
  "imageUrl": "https://...",
  "urlType": "permanent",
  "creditsRemaining": 95
}
```

**Rate Limit:** 20 requests per minute per user

### POST /api/generate-video

Generate an AI video from a scene image.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sceneId | string | Yes | Scene to generate for |
| projectId | string | Yes | Project ID |
| imageUrl | string | Yes | Source image URL |
| prompt | string | No | Motion prompt |

**Response (200 OK):**
```json
{
  "success": true,
  "predictionId": "prediction-id",
  "status": "starting"
}
```

**Note:** Video generation is asynchronous. Poll `/api/prediction-status/[predictionId]` for status.

### POST /api/generate-music

Generate AI background music.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prompt | string | Yes | Music description |
| duration | number | No | Duration in seconds |

**Response (200 OK):**
```json
{
  "success": true,
  "predictionId": "prediction-id",
  "status": "starting"
}
```

### POST /api/generate-voiceover

Generate AI voiceover narration.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| text | string | Yes | Text to speak |
| voice | string | No | Voice preset |

**Response (200 OK):**
```json
{
  "success": true,
  "audioUrl": "https://..."
}
```

### GET /api/prediction-status/[predictionId]

Check the status of an async generation (video/music).

**Response (200 OK):**
```json
{
  "status": "succeeded",
  "output": "https://..."
}
```

### POST /api/expand-story

Expand a story prompt into a complete project structure.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prompt | string | Yes | Story idea (20+ chars) |
| genre | string | No | Visual genre |
| mood | string | No | Overall mood |
| sceneCount | number | No | Number of scenes (3-10) |

**Response (200 OK):**
```json
{
  "success": true,
  "projectName": "The Crystal Guardian",
  "projectDescription": "A tale of ancient magic...",
  "visualStyle": "Fantasy Art",
  "characters": [...],
  "scenes": [...],
  "lore": [...]
}
```

**Rate Limit:** 10 requests per hour per user

### POST /api/ai-suggestions

Get AI suggestions to enhance a scene prompt.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prompt | string | Yes | Current scene prompt |

**Response (200 OK):**
```json
{
  "suggestions": [
    {
      "id": "sug-1",
      "type": "lighting",
      "title": "Golden Hour Magic",
      "description": "Add warm sunset lighting",
      "promptAddition": "bathed in golden hour light"
    }
  ]
}
```

### POST /api/ai-assist

Get AI assistance for content refinement.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| content | string | Yes | Content to refine |
| instruction | string | Yes | Refinement instruction |

### POST /api/refine-story

Refine and improve story content.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| content | string | Yes | Story content |
| style | string | No | Target style |

---

## Import

### POST /api/import/upload

Upload a document for import.

**Request:** Multipart form data with file

**Response (200 OK):**
```json
{
  "success": true,
  "text": "Document content...",
  "filename": "novel.pdf"
}
```

### POST /api/import/detect-chapters

Detect chapters in uploaded content.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| text | string | Yes | Document text |

**Response (200 OK):**
```json
{
  "chapters": [
    {
      "title": "Chapter 1",
      "content": "...",
      "startIndex": 0
    }
  ]
}
```

### POST /api/import/analyze

Analyze content for scene extraction.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| text | string | Yes | Content to analyze |

### POST /api/import/analyze-chapter

Analyze a specific chapter for visualization.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| content | string | Yes | Chapter content |
| title | string | No | Chapter title |

### POST /api/import/sanitize-prose

Sanitize prose for scene generation.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prose | string | Yes | Prose text |

---

## Export

### GET /api/export/project/[id]

Export a project as a ZIP archive.

**Response:** ZIP file containing:
- `project-info.json` - Project metadata
- `README.txt` - Project overview
- `all-prompts.txt` - All scene prompts
- `scenes/` - Scene folders with images and metadata

### GET /api/export/scene/[id]

Export a single scene.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| format | string | "pdf" (default) or "zip" |

### GET /api/projects/[projectId]/export

Alternative project export endpoint.

---

## Payments

### POST /api/payments/create-checkout

Create a Stripe checkout session.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| priceId | string | Yes | Stripe price ID |
| mode | string | No | "payment" or "subscription" |

**Response (200 OK):**
```json
{
  "sessionId": "cs_...",
  "url": "https://checkout.stripe.com/..."
}
```

### POST /api/payments/webhook

Stripe webhook handler for payment events.

### GET /api/credits

Get user's remaining credits.

**Response (200 OK):**
```json
{
  "credits": 100,
  "subscription": null
}
```

---

## Health & Status

### GET /api/health

Check API health status.

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2024-12-01T00:00:00Z"
}
```

### GET /api/storage-health

Check Supabase storage configuration (production-gated).

**Headers:**
| Header | Type | Required | Description |
|--------|------|----------|-------------|
| x-storage-health-token | string | Yes (prod) | Access token |

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Access denied |
| 404 | Not Found |
| 405 | Method Not Allowed |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
| 502 | Bad Gateway - External service error |
| 503 | Service Unavailable |

### Common Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication required |
| `INVALID_INPUT` | Request validation failed |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMITED` | Rate limit exceeded |
| `AI_ERROR` | AI service error |
| `INSUFFICIENT_CREDITS` | Not enough credits |

---

## Rate Limiting

Rate limits are applied per user per endpoint:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/generate-image` | 20 requests | 1 minute |
| `/api/generate-video` | 10 requests | 1 minute |
| `/api/generate-music` | 10 requests | 1 minute |
| `/api/generate-voiceover` | 20 requests | 1 minute |
| `/api/expand-story` | 10 requests | 1 hour |
| `/api/ai-suggestions` | 30 requests | 1 minute |
| All other endpoints | 100 requests | 1 minute |

When rate limited, you'll receive:

```json
{
  "error": "Rate limit exceeded. Please try again later."
}
```

With HTTP status `429 Too Many Requests`.

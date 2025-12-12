# HALCYON-Cinema API Reference

Complete API documentation for HALCYON-Cinema.

## Table of Contents

- [Authentication](#authentication)
- [Projects](#projects)
- [Scenes](#scenes)
- [Characters](#characters)
- [Lore](#lore)
- [Sequences](#sequences)
- [AI Features](#ai-features)
- [Export](#export)
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

**Response (200 OK):**
```json
{
  "message": "Password changed successfully"
}
```

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

**Response (200 OK):**
```json
{
  "message": "Account deleted successfully"
}
```

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

**Response (201 Created):**
```json
{
  "id": "uuid",
  "name": "My Project",
  "description": "A cinematic story...",
  "userId": "uuid",
  "createdAt": "2024-12-01T00:00:00Z",
  "updatedAt": "2024-12-01T00:00:00Z"
}
```

### GET /api/projects/[projectId]

Get a specific project with all related data.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "My Project",
  "description": "A cinematic story...",
  "scenes": [...],
  "characters": [...],
  "lore": [...],
  "sequences": [...]
}
```

### PUT /api/projects/[projectId]

Update a project.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | No | New name |
| description | string | No | New description |

### DELETE /api/projects/[projectId]

Delete a project and all associated data.

**Response (200 OK):**
```json
{
  "message": "Project deleted successfully"
}
```

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
| style | string | No | Visual style preset |
| metadata | object | No | Additional metadata |

**Metadata Object:**
| Field | Type | Description |
|-------|------|-------------|
| shotType | string | Wide Shot, Close-up, etc. |
| mood | string | Epic, Mysterious, etc. |
| lighting | string | Natural, Golden Hour, etc. |
| style | string | Visual style override |

**Response (201 Created):**
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "prompt": "A warrior stands on a cliff...",
  "imageUrl": null,
  "style": "cinematic-realism",
  "metadata": { ... },
  "createdAt": "2024-12-01T00:00:00Z"
}
```

### GET /api/scenes/[id]

Get a specific scene.

### PUT /api/scenes/[id]

Update a scene.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prompt | string | No | Updated prompt |
| style | string | No | Updated style |
| metadata | object | No | Updated metadata |

### DELETE /api/scenes/[id]

Delete a scene.

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
| visualDescription | string | No | Appearance for image gen |

**Response (201 Created):**
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "name": "Elena",
  "description": "A brave warrior...",
  "traits": ["brave", "loyal", "mysterious"],
  "visualDescription": "Tall woman with silver hair...",
  "createdAt": "2024-12-01T00:00:00Z"
}
```

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

**Response (201 Created):**
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "type": "location",
  "name": "Crystal Caverns",
  "summary": "Ancient caves filled with magical crystals",
  "description": "Deep beneath the mountains...",
  "tags": ["underground", "magical"],
  "createdAt": "2024-12-01T00:00:00Z"
}
```

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
| sceneIds | string[] | No | Ordered scene IDs |

### PUT /api/projects/[projectId]/sequences/[sequenceId]

Update a sequence (including scene order).

### DELETE /api/projects/[projectId]/sequences/[sequenceId]

Delete a sequence.

---

## AI Features

### POST /api/generate-image

Generate an AI image for a scene.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sceneId | string | Yes | Scene to generate for |
| prompt | string | Yes | Image description |
| style | string | No | Visual style preset |

**Response (200 OK):**
```json
{
  "imageUrl": "https://...",
  "urlType": "permanent"
}
```

**Rate Limit:** 20 requests per minute per user

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
  "characters": [
    {
      "name": "Elena",
      "description": "A brave guardian...",
      "traits": ["brave", "loyal"],
      "visualDescription": "Tall woman with silver hair..."
    }
  ],
  "scenes": [
    {
      "title": "The Awakening",
      "prompt": "A crystal cave illuminated by...",
      "shotType": "Wide Shot",
      "mood": "Mysterious",
      "lighting": "Ethereal",
      "characters": ["Elena"]
    }
  ],
  "lore": [
    {
      "type": "location",
      "name": "Crystal Caverns",
      "summary": "Ancient caves of power",
      "description": "Deep beneath the mountains..."
    }
  ]
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

**Rate Limit:** 30 requests per minute per user

---

## Export

### GET /api/export/project/[id]

Export a project as a ZIP archive.

**Response:** ZIP file containing:
- `project.json` - Project metadata
- `scenes/` - Scene images and metadata
- `characters.json` - Character data
- `lore.json` - Lore entries

### GET /api/export/scene/[id]

Export a single scene as PDF.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| format | string | "pdf" (default) or "png" |

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

**Response (200 OK):**
```json
{
  "status": "ok",
  "config": {
    "urlConfigured": true,
    "anonKeySet": true,
    "serviceKeySet": true
  }
}
```

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

---

## Rate Limiting

Rate limits are applied per user per endpoint:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/generate-image` | 20 requests | 1 minute |
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

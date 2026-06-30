# Social Media Integrator

A social media scheduling API with a comment management system that supports multiple platforms. Built with Node.js, TypeScript, Fastify, PostgreSQL, and Kysely.

## Overview

The system lets you create posts, publish them to multiple social platforms simultaneously, and manage engagement (fetch comments, reply) through a unified REST API — without needing to visit each platform separately.

See [DECISIONS.md](./DECISIONS.md) for architecture decision records and business assumptions.

---

## Database Schema

```
posts
  id              uuid  PK
  content         text  NOT NULL
  created_at      timestamptz

post_platforms
  id              uuid  PK
  post_id         uuid  FK → posts.id (CASCADE)
  platform        text  NOT NULL          -- 'twitter' | 'stub'
  platform_post_id text                   -- ID assigned by the platform after publish
  status          text  NOT NULL          -- 'published' | 'failed'
  error           text                    -- populated on failure
  published_at    timestamptz
  created_at      timestamptz
  UNIQUE (post_id, platform)

comments
  id              uuid  PK
  post_id         uuid  FK → posts.id
  platform        text  NOT NULL
  platform_comment_id text NOT NULL       -- external platform ID
  parent_id       uuid  FK → comments.id  -- NULL = top-level comment
  author_name     text  NOT NULL
  body            text  NOT NULL
  published_at    timestamptz
  created_at      timestamptz
  UNIQUE (platform, platform_comment_id)

comment_syncs
  id              uuid  PK
  post_id         uuid  FK → posts.id
  synced_at       timestamptz
  status          text  NOT NULL          -- 'ok' | 'failed'
```

`comments.parent_id` supports unlimited threading depth in the schema; the API currently exposes two levels (top-level + direct replies).

---

## API Design

### Posts

```
POST /posts
  Body: { "content": "Hello world" }
  → 201 { id, content, createdAt }

POST /posts/:postId/publish
  Body: { "platforms": ["twitter", "stub"] }
  → 200 { results: [{ platform, status, platformPostId? }] }
  Fan-out: all platforms attempted in parallel; one failure does not block others.
```

### Comments

```
GET /posts/:postId/platforms/:platform/comments
  → 200  Array of comment trees (top-level comments with nested replies)
  Headers:
    X-Sync-Status: ok | failed | skipped
    X-Synced-At:   ISO timestamp
  Auto-syncs from platform if cache is stale (TTL default: 5 min).

POST /posts/:postId/platforms/:platform/comments/syncs
  → 200 { status: "ok", syncedAt }
  Force a sync regardless of TTL.

POST /posts/:postId/platforms/:platform/comments/:commentId/replies
  Body: { "body": "Reply text" }
  → 201 { id, body, parentId, authorName, publishedAt }
```

---

## Key TypeScript Code

### Platform Adapter Interface

Every platform implements a single interface. Adding a new platform means implementing three methods:

```typescript
export interface PlatformAdapter {
  readonly platform: Platform

  // Pull comments from the platform and return them in a normalized shape
  fetchComments(platformPostId: string): Promise<RawComment[]>

  // Post a reply and return the created comment
  postReply(platformCommentId: string, body: string): Promise<RawComment>

  // Publish a new post and return the platform-assigned ID
  publishPost(content: string): Promise<{ platformPostId: string }>
}
```

### Multi-Platform Publish (fan-out with partial failure)

```typescript
const settled = await Promise.allSettled(
  platforms.map(async (platform): Promise<PublishResult> => {
    const adapter = getAdapter(deps.adapters, platform)
    const { platformPostId } = await adapter.publishPost(post.content)
    await deps.postPlatformRepo.upsert(postId, platform, { status: 'published', platformPostId })
    return { platform, status: 'published', platformPostId }
  }),
)
// failures recorded per-platform; caller always gets a result per platform
```

### Cache-First Comment Sync

```typescript
// GET /comments handler
const sync = await getLatestSync(postId, platform)
if (!sync || isStale(sync.syncedAt, ttlMs)) {
  await syncComments({ commentRepo, adapter, postId, platformPostId })
}
return getComments(postId, platform)  // always served from local DB
```

---

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Required variables:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/social-media-integrator

# Twitter — all five required to enable the Twitter adapter
TWITTER_BEARER_TOKEN=...       # app-only read token
TWITTER_API_KEY=...            # OAuth 1.0a consumer key
TWITTER_API_SECRET=...         # OAuth 1.0a consumer secret
TWITTER_ACCESS_TOKEN=...       # OAuth 1.0a access token (needs Read+Write)
TWITTER_ACCESS_TOKEN_SECRET=...

COMMENT_SYNC_TTL_MS=300000     # 5 minutes default
```

> Twitter write operations (publish post, reply to comment) require OAuth 1.0a. The Bearer Token alone is read-only. All five vars must be set; if any is missing the Twitter adapter is silently skipped and only the stub adapter is available.

### 3. Start the Database

```bash
docker compose up -d          # development
docker compose -f docker-compose.test.yml up -d  # test database (port 5433)
```

### 4. Run Migrations

```bash
npm run migrate
```

### 5. Start the Server

```bash
npm run dev    # development with hot reload
npm run build && npm start  # production
```

---

## Testing

```bash
# All tests (requires test DB on port 5433)
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/social-media-integrator-test npm test

# Single file
npx vitest run tests/e2e/posts.e2e.test.ts
```

Test layers:
- **Unit** — use case logic with in-memory fakes (`tests/unit/`)
- **Integration** — repository layer against real PostgreSQL (`tests/integration/`)
- **E2E** — full HTTP stack with StubAdapter (`tests/e2e/`)
- **Adapter** — Twitter adapter with nock HTTP interception (`tests/adapters/`)

---

## Adding a New Platform

1. Implement `PlatformAdapter` in `src/engagement/infrastructure/platform/<name>/<name>.adapter.ts`
2. Register it in `src/container.ts`
3. Add the platform name to the `Platform` union in `src/engagement/domain/comment.entity.ts`

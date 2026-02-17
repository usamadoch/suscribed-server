# Product Requirements Document — Suscribed Server

> **Version:** 1.0  
> **Date:** February 17, 2026  
> **Author:** Dean Usama  
> **Stack:** Node.js · TypeScript · Express · MongoDB (Mongoose) · Socket.IO · Redis · Zod  

---

## 1. Executive Summary

**Suscribed** is a creator-economy platform modeled after Patreon. It enables *creators* to publish gated and public content (text, image, video), manage a subscriber community, communicate via real-time messaging, and track engagement through an analytics dashboard. *Members* can discover creators, subscribe to their pages, interact with posts (like, comment), and receive real-time notifications.

The backend is a **monolithic Express API** served over HTTP with an integrated **Socket.IO** real-time layer. Data persistence is handled by **MongoDB** via Mongoose ODM. An optional **Redis** layer provides rate-limit persistence and is prepared for Socket.IO horizontal scaling. Media is processed externally by **Cloudinary** (images) and **Mux** (video), with the server acting as a secure signing/webhook proxy. Authentication is entirely internal (JWT + HTTP-only cookies), supplemented by Google OAuth2.

The system is currently in an MVP state with several production-oriented foundations already in place (graceful shutdown, structured logging, Swagger docs, RBAC, rate limiting, content access control, etc.).

---

## 2. Product Overview

### 2.1 Core Value Proposition

| Persona | Value |
|---|---|
| **Creator** | Publish content, gate posts behind membership, track analytics, manage community, message subscribers |
| **Member** | Discover creators, subscribe to pages, consume gated content, like/comment, message creators |
| **Admin** | Full system access (super-set of creator + member permissions) |

### 2.2 Key Features (Derived from Route Files)

| Feature Area | Route Prefix | Route File |
|---|---|---|
| Authentication & Identity | `/api/auth` | `auth.ts` |
| Creator Pages | `/api/pages` | `page.ts` |
| Posts & Content | `/api/posts` | `post.ts` |
| Memberships | `/api/memberships` | `membership.ts` |
| Real-time Messaging | `/api/conversations` | `conversation.ts` |
| Media Pipeline | `/api/media` | `media.ts` |
| User Profiles | `/api/users` | `user.ts` |
| Notifications | `/api/notifications` | `notification.ts` |
| Creator Analytics | `/api/analytics` | `analytics.ts` |

### 2.3 Operational Features

- Health & readiness probes (`/api/health`, `/api/ready`)
- Swagger API documentation (`/api-docs`)
- Structured JSON logging with correlation IDs
- Graceful shutdown with resource cleanup
- Feature flag system for Redis cache, background jobs, and audit logs

---

## 3. System Architecture Overview

### 3.1 Architecture Pattern

The application follows a **Layered MVC+ architecture** with an emerging service layer:

```
Client (SPA)
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Express Application  (index.ts — bootstrap)                   │
│  ┌──────────────────────────────────────────────────┐          │
│  │ Global Middleware                                 │          │
│  │  correlationId → requestLogger → CORS → bodyParser│          │
│  │  → cookieParser → rateLimiter                    │          │
│  └──────────┬───────────────────────────────────────┘          │
│             ▼                                                   │
│  ┌──────────────────────────────────────────────────┐          │
│  │ Routes (server/src/routes/*)                      │          │
│  │  Endpoint declaration, middleware chaining,        │          │
│  │  request validation (Zod), auth guards             │          │
│  └──────────┬───────────────────────────────────────┘          │
│             ▼                                                   │
│  ┌──────────────────────────────────────────────────┐          │
│  │ Controllers (server/src/controllers/*)            │          │
│  │  Request parsing, orchestration, response shaping  │          │
│  │  Delegates to Services/Models, calls error handler │          │
│  └──────────┬───────────────────────────────────────┘          │
│             ▼                                                   │
│  ┌──────────────────────────────────────────────────┐          │
│  │ Services (server/src/services/*)                  │          │
│  │  Business logic for auth, notifications, media     │          │
│  │  Encapsulates multi-model transactions             │          │
│  └──────────┬───────────────────────────────────────┘          │
│             ▼                                                   │
│  ┌──────────────────────────────────────────────────┐          │
│  │ Models (server/src/models/*)                      │          │
│  │  Mongoose schemas, pre-save hooks, indexes         │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                 │
│  ┌──────────────────────────────────────────────────┐          │
│  │ Sockets (server/src/sockets/index.ts)             │          │
│  │  JWT auth middleware, room management,             │          │
│  │  typing indicators, message events                 │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
    │                          │                    │
    ▼                          ▼                    ▼
 MongoDB               Redis (optional)       Cloudinary / Mux
```

### 3.2 Request Lifecycle

```
HTTP Request
  │
  ├─► correlationIdMiddleware  (assigns X-Correlation-Id)
  ├─► requestLogger            (structured access log)
  ├─► CORS guard               (origin whitelist from config)
  ├─► JSON body parser         (skips Mux webhook path)
  ├─► cookieParser             (signed cookies)
  ├─► apiLimiter               (global rate limit: 100 req/min)
  │
  ├─► Route-specific middleware
  │     ├─ rateLimiter (login, signup, etc.)
  │     ├─ protect / optionalAuth / requireCreator / requirePermission
  │     └─ validate(zodSchema)
  │
  ├─► Controller function
  │     ├─ Parses request body / params / query
  │     ├─ Calls service or model directly
  │     ├─ Shapes response envelope: { success, data, meta? }
  │     └─ Calls next(error) on failure
  │
  └─► Global errorHandler
        ├─ AppError (operational) → logged as warn, returns typed error code
        └─ Unknown Error → logged as error, returns 500 SERVER_ERROR
```

### 3.3 Folder Responsibilities

| Folder | Role | Summary |
|---|---|---|
| `config/` | Centralized configuration | Environment variables, DB connection, Redis, Swagger, structured logger |
| `constants/` | Static data | RBAC permission matrix |
| `controllers/` | Request handlers | 9 controller modules — one per feature; parse request, orchestrate logic, format response |
| `middleware/` | Cross-cutting concerns | `auth.ts` (JWT protect / optionalAuth / RBAC), `validate.ts` (Zod), `errorHandler.ts` (AppError class + global handler), `rateLimiter.ts` (Redis-backed) |
| `models/` | Data layer | 11 Mongoose schemas with validation, indexes, and pre-save hooks |
| `routes/` | Endpoint registry | 9 route modules — declares HTTP methods, chains middleware, maps to controllers |
| `services/` | Business logic | `authService.ts` (signup/login/token/Google OAuth), `notificationService.ts` (single + mass notify, preference checks), `media/` (Cloudinary + Mux SDK wrappers) |
| `sockets/` | Real-time | Socket.IO init, JWT auth middleware, room management, typing indicators, presence tracking |
| `types/` | TypeScript definitions | Central type barrel — interfaces for all models, request types, API response envelopes, discriminated unions for access control |
| `utils/` | Shared utilities | Zod validation schemas, standardized error code registry, Cloudinary transform helpers, post access control (content gatekeeping) |
| `jobs/` | Background processing | BullMQ queue definitions and worker stubs (currently commented out — not active) |

---

## 4. Feature Breakdown

### 4.1 Authentication & Identity (`/api/auth`)

| Endpoint | Method | Auth | Middleware | Description |
|---|---|---|---|---|
| `/signup` | POST | Public | `signupLimiter`, `validate(signupSchema)` | Register with email/password/role; auto-creates CreatorPage for creator role |
| `/check-email` | POST | Public | `validate(checkEmailSchema)` | Returns `{ exists: boolean }` |
| `/login` | POST | Public | `loginLimiter`, `validate(loginSchema)` | Email/password login; returns JWT in HTTP-only cookies |
| `/google` | POST | Public | — | Google OAuth2 authorization code exchange; creates user if new |
| `/refresh` | POST | Public | — | Rotates access + refresh tokens from cookie-based refresh token |
| `/logout` | POST | Protected | `protect` | Revokes refresh token(s), clears cookies |
| `/me` | GET | Protected | `protect` | Returns current user profile (minus passwordHash) |
| `/change-password` | POST | Protected | `protect`, `validate(changePasswordSchema)` | Verifies current password, updates to new; blocks Google-authenticated users |

**Key Implementation Details:**
- Tokens delivered via `httpOnly` signed cookies with `SameSite=None` in production
- Access token: 15-minute lifespan (JWT signed with `HS256`)
- Refresh token: 7-day lifespan (crypto random hex, stored in MongoDB)
- Password hashing: `bcryptjs` with salt rounds = 12
- Duplicate-key protection on email and username (unique MongoDB indexes)
- Google OAuth: Uses authorization code flow via `google-auth-library`; auto-generates unique username; can upgrade member → creator role

### 4.2 Creator Pages (`/api/pages`)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/` | GET | Public | List all published, public creator pages (sorted by member count, limit 50) |
| `/my/page` | GET | Creator | Get own creator page |
| `/my/page` | PUT | Creator | Update page settings (name, tagline, slug, theme, social links, visibility) |
| `/:slug` | GET | Optional | Get page by slug — returns `isOwner`, `isMember`, `isRestricted` flags; hides draft pages from non-owners |
| `/:pageId/posts` | GET | Optional | Get published posts for a page with visibility filtering based on membership |

**Key Implementation Details:**
- Auto-corrects `postCount` when it drifts from actual `Post.countDocuments()`
- Private pages return a limited data payload for non-members
- Draft pages return 404 for non-owners (hides existence)

### 4.3 Posts & Content (`/api/posts`)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/` | GET | Optional | Feed — paginated, filterable by `pageId`, `postType`, `visibility`, `status` |
| `/:id` | GET | Optional | Single post with access-controlled content |
| `/` | POST | Creator | Create post with caption, media attachments, tags, visibility, scheduling |
| `/:id` | PUT | Creator | Update post (ownership verified) |
| `/:id` | DELETE | Creator | Delete post + associated Cloudinary/Mux assets + decrement page postCount |
| `/:id/like` | POST | Protected | Toggle like/unlike (atomic via compound unique index) |
| `/:id/comments` | GET | Optional | Paginated comment tree (depth ≤ 3); nested replies populated |
| `/:id/comments` | POST | Protected | Add comment/reply; enforces `allowComments` flag; notifies post creator |

**Key Implementation Details:**
- **Content gatekeeping** via `postAccessControl.ts`: Members-only posts have their caption nulled, media URLs replaced with blurred Cloudinary/Mux thumbnails, and an `isLocked: true` discriminant added
- Batch sanitization via `sanitizePostsForClient()` with a membership lookup map for O(1) access checks
- Media dimensions auto-extracted from Mux track metadata on creation
- Post status auto-sets `publishedAt` via Mongoose pre-save hook
- Comment tree supports up to 3 levels of nesting

### 4.4 Memberships (`/api/memberships`)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/` | GET | Protected | List user's active memberships (as member) with populated page/creator info |
| `/my-members` | GET | Protected | List creator's members with profile info |
| `/` | POST | Protected | Join a creator — creates membership, increments memberCount, sends notification |
| `/:id` | DELETE | Protected | Leave creator — soft-cancels membership, decrements memberCount |
| `/check/:pageId` | GET | Protected | Check if current user is an active member of a page |

**Key Implementation Details:**
- Compound unique index `{ memberId, creatorId }` prevents duplicate memberships
- Re-activation path: if cancelled membership exists, reactivates instead of creating new
- Real-time notification dispatched to creator on new member join

### 4.5 Messaging (`/api/conversations`)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/` | GET | Protected | List user's conversations with last message and unread counts |
| `/` | POST | Protected | Start or retrieve existing conversation (creator-member pair constraint) |
| `/unread-count` | GET | Protected | Global unread badge count across all conversations |
| `/:id/messages` | GET | Protected | Paginated messages for a conversation (participant verification) |
| `/:id/messages` | POST | Protected | Send message — emits Socket.IO event, updates conversation metadata, fires notification |
| `/:conversationId/messages/:messageId/read` | PUT | Protected | Mark message read — emits read receipt, decrements unread count |

**Socket.IO Events:**
| Event | Direction | Description |
|---|---|---|
| `join_room` / `leave_room` | Client → Server | Join/leave conversation room |
| `typing` / `stop_typing` | Client → Server → Room | Typing indicators |
| `new_message` | Server → Room | Real-time message delivery |
| `message_read` | Server → Room | Read receipt broadcast |
| `notification` | Server → User Room | In-app notification push |
| `user_online` / `user_offline` | Server → Broadcast | Presence status |

**Key Implementation Details:**
- Conversations are strictly 1:1 (creator ↔ member), enforced by compound unique index
- Unread counts maintained as a `Map` field on the Conversation document
- Message notifications aggregate: subsequent unread messages to same conversation update existing notification's `messageCount` instead of creating new ones
- Socket auth extracts JWT from either `handshake.auth.token` or parsed `Cookie` header

### 4.6 Media Pipeline (`/api/media`)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/cloudinary/signature` | GET | Protected | Generate signed Cloudinary upload params (timestamp, signature, folder path) |
| `/mux/upload-url` | GET | Protected | Create Mux direct upload URL for video |
| `/:type/:id` | DELETE | Protected | Delete Cloudinary asset or Mux asset by type |
| `/mux/webhook` | POST | Public | Mux webhook receiver — updates post media status, extracts playback IDs and dimensions |

**Key Implementation Details:**
- Cloudinary signatures computed server-side to avoid exposing API secret to client
- Upload folder path sanitized to prevent path traversal
- Mux webhook verifies signature using raw body parsing (`express.raw`)
- Webhook handles `video.asset.ready` and `video.asset.errored` events; updates matching post's `mediaAttachments` in-place
- Video dimensions extracted from Mux track metadata

### 4.7 User Profiles (`/api/users`)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/id/:id` | GET | Public | Get profile by ID (excludes password + notification prefs) |
| `/:username` | GET | Public | Get profile by username; includes CreatorPage if role=creator |
| `/me` | PUT | Protected | Update own display name, bio, notification preferences |

### 4.8 Notifications (`/api/notifications`)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/` | GET | Protected | Paginated notifications with optional `unreadOnly` filter |
| `/unread-count` | GET | Protected | Count of unread notifications |
| `/:id/read` | PUT | Protected | Mark single notification as read |
| `/read-all` | PUT | Protected | Mark all as read (bulk update) |
| `/:id` | DELETE | Protected | Delete notification (ownership scoped) |

**Notification Types:**
`new_member` · `member_left` · `new_post` · `post_liked` · `new_comment` · `comment_reply` · `new_message` · `mention` · `creator_went_live` · `system`

**Key Implementation Details:**
- User-level notification preferences control whether each type is generated
- Quiet hours support with timezone awareness (configured but not yet enforced in delivery)
- TTL expiry via MongoDB TTL index on `expiresAt`
- Real-time delivery via Socket.IO `user:{userId}` room

### 4.9 Creator Analytics (`/api/analytics`)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/overview` | GET | Creator | Dashboard KPIs: total members, new members, member growth %, views, view growth %, engagement rate, total posts/likes/comments |
| `/members` | GET | Creator | Daily member growth aggregation (7/30/90 days) |
| `/posts` | GET | Creator | Top-performing posts (by views) and recent posts |
| `/engagement` | GET | Creator | Breakdown of likes, comments, views with percentage rates |

**Key Implementation Details:**
- Time range validated as 7, 30, or 90 days
- Period-over-period growth calculated against the previous equivalent window
- Engagement rate: `(likes + comments) / views × 100`
- Uses MongoDB aggregation pipeline for daily member growth charts

---

## 5. Data Modeling Strategy

### 5.1 Entity Relationship Diagram

```
┌──────────┐     1:1      ┌──────────────┐
│   User   │─────────────▶│ CreatorPage  │
│          │              │              │
│ _id      │◁─┬──────────│ userId (FK)  │
│ email    │  │           │ pageSlug     │
│ username │  │           │ displayName  │
│ role     │  │           │ memberCount  │
│ password │  │           │ postCount    │
│ googleId │  │           │ theme        │
│ prefs    │  │           │ socialLinks  │
└──────────┘  │           └──────────────┘
              │                    ▲
         ┌────┤                    │
         │    │           ┌────────┴───────┐
         │    │    N:1    │     Post       │
         │    │◁──────────│ creatorId (FK) │
         │    │           │ pageId (FK)    │
         │    │           │ caption        │
         │    │           │ mediaAttach[]  │
         │    │           │ postType       │
         │    │           │ visibility     │
         │    │           │ status         │
         │    │           │ likeCount      │
         │    │           │ commentCount   │
         │    │           │ viewCount      │
         │    │           └───────┬────────┘
         │    │                   │
         │    │      ┌────────────┼────────────┐
         │    │      ▼            ▼            ▼
         │    │ ┌──────────┐ ┌──────────┐ ┌──────────┐
         │    │ │ PostLike │ │ PostView │ │ Comment  │
         │    │ │ postId   │ │ postId   │ │ postId   │
         │    │ │ userId   │ │ userId?  │ │ authorId │
         │    │ │          │ │ sessionId│ │ parentId │
         │    │ └──────────┘ │ duration │ │ depth    │
         │    │              └──────────┘ │ likeCount│
         │    │                           │ replyCount│
         │    │                           └──────────┘
         │    │
    ┌────┘    │
    │         │
    ▼         ▼
┌──────────┐  ┌──────────────┐
│Membership│  │ Conversation │     1:N    ┌──────────┐
│ memberId │  │ creatorId    │───────────▶│ Message  │
│ creatorId│  │ memberId     │            │ convId   │
│ pageId   │  │ participants │            │ senderId │
│ status   │  │ lastMessage  │            │ content  │
│ joinedAt │  │ unreadCounts │            │ status   │
└──────────┘  └──────────────┘            │ readAt   │
                                          └──────────┘
         ┌──────────────┐    ┌──────────────┐
         │ Notification │    │ RefreshToken │
         │ recipientId  │    │ userId       │
         │ type         │    │ token        │
         │ title/body   │    │ expiresAt    │
         │ actionUrl    │    │ (TTL Index)  │
         │ metadata     │    └──────────────┘
         │ isRead       │
         │ expiresAt    │
         │ (TTL Index)  │
         └──────────────┘
```

### 5.2 Model Summary

| Model | Collections | Key Fields | Indexes | Notable Features |
|---|---|---|---|---|
| **User** | `users` | email, username, role, passwordHash, googleId, notificationPreferences | email, username, googleId, createdAt | bcrypt pre-save hook, `comparePassword()` method, `select: false` on passwordHash |
| **CreatorPage** | `creatorpages` | userId, pageSlug, displayName, tagline, about, socialLinks, theme, memberCount, postCount | pageSlug, userId, isPublic, memberCount, createdAt | 1:1 with User; auto-created on creator signup |
| **Post** | `posts` | creatorId, pageId, caption, mediaAttachments[], postType, visibility, status, likeCount, viewCount, commentCount | (creatorId, status), (pageId, status, publishedAt), (visibility, status, publishedAt), muxUploadId, muxAssetId | Pre-save hook sets `publishedAt`; embedded media sub-docs |
| **PostLike** | `postlikes` | postId, userId | Compound unique (postId, userId) | Toggle semantics via insert/delete |
| **PostView** | `postviews` | postId, userId, sessionId, viewedAt, duration | (postId, viewedAt), (postId, userId), (postId, sessionId) | Supports anonymous + authenticated tracking |
| **Comment** | `comments` | postId, authorId, content, parentId, depth, likeCount, replyCount | (postId, createdAt), (postId, parentId), authorId, parentId | Max depth = 3; threaded reply support |
| **Membership** | `memberships` | memberId, creatorId, pageId, status, joinedAt, cancelledAt, totalVisits | Compound unique (memberId, creatorId), (creatorId, status), (memberId, status), pageId | Soft-cancel with reactivation path |
| **Conversation** | `conversations` | participants[], creatorId, memberId, lastMessage, unreadCounts (Map) | Compound unique (creatorId, memberId), participants, updatedAt | 1:1 per creator-member pair |
| **Message** | `messages` | conversationId, senderId, content, contentType, attachments[], status, readAt | (conversationId, createdAt), senderId, (conversationId, status) | Soft-delete support |
| **Notification** | `notifications` | recipientId, type, title, body, actionUrl, metadata, isRead, expiresAt | (recipientId, isRead, createdAt), (recipientId, createdAt), TTL on expiresAt | Auto-aggregates message notifications; TTL auto-cleanup |
| **RefreshToken** | `refreshtokens` | userId, token, expiresAt | TTL on expiresAt, userId, token | Auto-cleanup via MongoDB TTL |

### 5.3 Embedded vs Referenced Decisions

| Data | Strategy | Rationale |
|---|---|---|
| `mediaAttachments` in Post | **Embedded** (sub-document array) | Always fetched with post; bounded cardinality (max 10); no cross-document queries needed |
| `socialLinks` in CreatorPage | **Embedded** | Always fetched with page; max 10 links |
| `lastMessage` in Conversation | **Embedded** (denormalized) | Avoids JOIN for conversation list; write frequency acceptable |
| `unreadCounts` in Conversation | **Embedded** (Map) | Quick O(1) lookup per participant; only 2 participants |
| Post ↔ Like | **Referenced** (separate `PostLike` collection) | High cardinality; needs unique constraint; unbounded |
| Post ↔ View | **Referenced** (separate `PostView` collection) | Analytics-grade data; needs time-series queries |
| Post ↔ Comment | **Referenced** (separate `Comment` collection) | Threaded structure; independent pagination |

---

## 6. API Structure & Endpoint Organization

### 6.1 Response Envelope Convention

All API responses follow a consistent envelope:

```typescript
// Success
{
  success: true,
  data: { ... },
  meta?: {
    pagination?: {
      page: number,
      limit: number,
      totalItems: number,
      totalPages: number,
      hasNextPage: boolean,
      hasPrevPage: boolean
    }
  }
}

// Error
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",     // Machine-readable error code
    message: "Human-readable msg",
    details?: {                    // Zod validation errors by field
      "email": ["Invalid email address"],
      "password": ["Must contain uppercase letter"]
    }
  }
}
```

### 6.2 Complete Endpoint Registry

#### Auth (`/api/auth`) — 8 endpoints
| Method | Path | Auth | Rate Limit |
|---|---|---|---|
| POST | `/signup` | Public | 3/hr |
| POST | `/check-email` | Public | Global |
| POST | `/login` | Public | 5/15min |
| POST | `/google` | Public | Global |
| POST | `/refresh` | Public | Global |
| POST | `/logout` | Protected | Global |
| GET | `/me` | Protected | Global |
| POST | `/change-password` | Protected | Global |

#### Pages (`/api/pages`) — 5 endpoints
| Method | Path | Auth |
|---|---|---|
| GET | `/` | Public |
| GET | `/my/page` | Creator |
| PUT | `/my/page` | Creator |
| GET | `/:slug` | Optional |
| GET | `/:pageId/posts` | Optional |

#### Posts (`/api/posts`) — 8 endpoints
| Method | Path | Auth |
|---|---|---|
| GET | `/` | Optional |
| GET | `/:id` | Optional |
| POST | `/` | Creator |
| PUT | `/:id` | Creator |
| DELETE | `/:id` | Creator |
| POST | `/:id/like` | Protected |
| GET | `/:id/comments` | Optional |
| POST | `/:id/comments` | Protected |

#### Memberships (`/api/memberships`) — 5 endpoints
| Method | Path | Auth |
|---|---|---|
| GET | `/` | Protected |
| GET | `/my-members` | Protected |
| POST | `/` | Protected |
| DELETE | `/:id` | Protected |
| GET | `/check/:pageId` | Protected |

#### Conversations (`/api/conversations`) — 6 endpoints
| Method | Path | Auth |
|---|---|---|
| GET | `/` | Protected |
| POST | `/` | Protected |
| GET | `/unread-count` | Protected |
| GET | `/:id/messages` | Protected |
| POST | `/:id/messages` | Protected |
| PUT | `/:conversationId/messages/:messageId/read` | Protected |

#### Media (`/api/media`) — 4 endpoints
| Method | Path | Auth |
|---|---|---|
| GET | `/cloudinary/signature` | Protected |
| GET | `/mux/upload-url` | Protected |
| DELETE | `/:type/:id` | Protected |
| POST | `/mux/webhook` | Public (signature verified) |

#### Users (`/api/users`) — 3 endpoints
| Method | Path | Auth |
|---|---|---|
| GET | `/id/:id` | Public |
| GET | `/:username` | Public |
| PUT | `/me` | Protected |

#### Notifications (`/api/notifications`) — 5 endpoints
| Method | Path | Auth |
|---|---|---|
| GET | `/` | Protected |
| GET | `/unread-count` | Protected |
| PUT | `/:id/read` | Protected |
| PUT | `/read-all` | Protected |
| DELETE | `/:id` | Protected |

#### Analytics (`/api/analytics`) — 4 endpoints
| Method | Path | Auth |
|---|---|---|
| GET | `/overview` | Creator |
| GET | `/members` | Creator |
| GET | `/posts` | Creator |
| GET | `/engagement` | Creator |

**Total: 48 endpoints**

---

## 7. Authentication & Authorization Flow

### 7.1 Authentication Mechanisms

```
┌─────────────────────────────────────────────────────────┐
│  Two Auth Paths                                         │
│                                                         │
│  Path 1: Email/Password                                 │
│  ┌──────┐    ┌──────────┐    ┌───────────────┐         │
│  │Client├───▶│POST /login├───▶│authService    │         │
│  └──┬───┘    └──────────┘    │.login()       │         │
│     │                        │ → findUser     │         │
│     │                        │ → comparePass  │         │
│     │                        │ → genTokens    │         │
│     │   Set-Cookie:          │ → store refresh│         │
│     │◁─ accessToken (15m)    └───────────────┘         │
│     │◁─ refreshToken (7d)                               │
│                                                         │
│  Path 2: Google OAuth2                                  │
│  ┌──────┐    ┌───────────┐    ┌───────────────┐        │
│  │Client├───▶│POST /google├───▶│authService    │        │
│  └──┬───┘    └───────────┘    │.googleLogin() │        │
│     │                         │ → exchange code│        │
│     │                         │ → verify token │        │
│     │                         │ → find/create  │        │
│     │◁─ Same cookie strategy  │ → genTokens    │        │
│                               └───────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Token Strategy

| Token | Storage | Lifespan | Format |
|---|---|---|---|
| Access Token | `httpOnly` cookie (`accessToken`) | 15 minutes | JWT (HS256) — payload: `{ userId, email, role }` |
| Refresh Token | `httpOnly` cookie (`refreshToken`) | 7 days | 40-byte crypto random hex — persisted in `RefreshToken` collection |

**Refresh flow:** Client calls `POST /api/auth/refresh` → server validates refresh token from cookie → deletes old refresh token → generates new pair → sets new cookies.

### 7.3 Middleware Stack

| Middleware | Export | Use |
|---|---|---|
| `protect` | Named export | **Required auth** — extracts JWT from cookie or `Authorization: Bearer`, verifies, fetches user from DB, attaches to `req.user` |
| `optionalAuth` | Named export | **Optional auth** — same as protect but silently proceeds if no token |
| `requireCreator` | Named export | **Role guard** — requires `role = 'creator' | 'admin'` |
| `requireAdmin` | Named export | **Role guard** — requires `role = 'admin'` |
| `requireRole(...roles)` | Named export | **Generic role guard** — variadic |
| `requirePermission(perm)` | Named export | **Permission guard** — checks RBAC matrix from `constants/permissions.ts` |

### 7.4 RBAC Permission Matrix

| Permission | Creator | Member | Admin |
|---|---|---|---|
| `post:create` | ✅ | ❌ | ✅ |
| `post:read` | ✅ | ✅ | ✅ |
| `post:update` | ✅ | ❌ | ✅ |
| `post:delete` | ✅ | ❌ | ✅ |
| `dashboard:view` | ✅ | ❌ | ✅ |
| `analytics:view` | ✅ | ❌ | ✅ |
| `members:view` | ✅ | ❌ | ✅ |
| `payouts:view` | ✅ | ❌ | ✅ |
| `page:manage` | ✅ | ❌ | ✅ |
| `explore:view` | ❌ | ✅ | ✅ |
| `subscriptions:view` | ❌ | ✅ | ✅ |
| `security:manage` | ❌ | ✅ | ❌ |
| `admin:access` | ❌ | ❌ | ✅ |

---

## 8. Validation & Error Handling Architecture

### 8.1 Input Validation (Zod)

All request body validation is centralized in `utils/validators.ts` using **Zod schemas**.

| Schema | Used By | Key Rules |
|---|---|---|
| `signupSchema` | POST `/auth/signup` | email regex, password ≥8 + uppercase + number + special, username ≥3 lowercase alphanumeric |
| `loginSchema` | POST `/auth/login` | email required, password required |
| `checkEmailSchema` | POST `/auth/check-email` | email regex |
| `changePasswordSchema` | POST `/auth/change-password` | currentPassword required, newPassword with same strength rules |
| `createPostSchema` | POST `/posts` | caption ≥1 ≤2200, mediaAttachments discriminated union by type (image/video), max 10 tags, visibility enum |
| `updatePostSchema` | PUT `/posts/:id` | Partial of createPostSchema |
| `updatePageSchema` | PUT `/pages/my/page` | Optional fields: displayName, tagline, slug, about, socialLinks (url validation), theme (hex color regex) |
| `createCommentSchema` | POST `/posts/:id/comments` | content ≥1 ≤2000, optional parentId |
| `sendMessageSchema` | POST `/conversations/:id/messages` | content ≥1 ≤5000, contentType enum |
| `updateUserSchema` | PUT `/users/me` | Optional displayName, bio, deeply-nested notificationPreferences |

The `validate()` middleware catches `ZodError` and transforms it into a structured `{ details: { [fieldPath]: string[] } }` error response.

### 8.2 Error Handling System

**Architecture:**

```
ZodError                    → validate middleware → AppError(VALIDATION_ERROR, details)
Business logic error        → throw createError.xxx() → AppError (operational)
Unexpected error            → catch block → next(error) → errorHandler
MongoDB unique violation    → catch block → controller maps to createError.duplicateXxx()
JWT errors                  → auth middleware → createError.unauthorized / tokenExpired
```

**Error Code Registry** (`utils/errorCodes.ts`):

| Category | Codes | HTTP Status |
|---|---|---|
| Auth | `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `INVALID_TOKEN` | 401 |
| Authorization | `FORBIDDEN`, `INSUFFICIENT_PERMISSIONS`, `NOT_OWNER` | 403 |
| Validation | `VALIDATION_ERROR`, `INVALID_INPUT`, `MISSING_REQUIRED_FIELD` | 400 |
| Not Found | `NOT_FOUND`, `USER_NOT_FOUND`, `POST_NOT_FOUND`, `PAGE_NOT_FOUND`, `MEMBERSHIP_NOT_FOUND`, `CONVERSATION_NOT_FOUND`, `MESSAGE_NOT_FOUND`, `NOTIFICATION_NOT_FOUND` | 404 |
| Conflict | `CONFLICT`, `ALREADY_EXISTS`, `DUPLICATE_EMAIL`, `DUPLICATE_USERNAME`, `ALREADY_MEMBER` | 409 |
| Rate Limit | `RATE_LIMITED`, `TOO_MANY_REQUESTS` | 429 |
| Server | `SERVER_ERROR`, `DATABASE_ERROR` | 500 |
| Business Logic | `COMMENTS_DISABLED`, `MEMBERS_ONLY`, `ACCOUNT_DEACTIVATED` | 403 |

**AppError class** distinguishes operational errors (`isOperational = true`) from programming errors. Operational errors are logged at `warn` level; unexpected errors at `error` level.

---

## 9. Security Considerations

### 9.1 Implemented Security Measures

| Measure | Implementation |
|---|---|
| **JWT in HTTP-only cookies** | Prevents XSS-based token theft; `Secure` and `SameSite=none` in production |
| **Cookie signing** | `cookieParser(config.cookie.secret)` for tamper detection |
| **Password hashing** | bcryptjs with 12 salt rounds |
| **Password strength** | Enforced via Zod: ≥8 chars + uppercase + number + special character |
| **Rate limiting** | Per-endpoint rate limiters (login: 5/15min, signup: 3/hr, API: 100/min); Redis-backed in production, memory-backed in dev |
| **CORS whitelist** | Dynamic origin validation against `CLIENT_URL` |
| **Input validation** | Zod schemas on all mutating endpoints |
| **Trust proxy** | `app.set('trust proxy', 1)` for correct IP extraction behind reverse proxy |
| **Ownership verification** | Controllers verify `req.user._id` matches resource owner before mutations |
| **Content gatekeeping** | Members-only posts have sensitive data stripped server-side |
| **Webhook signature verify** | Mux webhooks verified via raw body + webhook secret |
| **Refresh token rotation** | Old refresh token deleted on each use (prevents replay) |
| **Account deactivation** | `isActive` flag checked in auth middleware and login |
| **Query injection prevention** | Mongoose parameterized queries; no raw MongoDB operators exposed |
| **Upload path sanitization** | `sanitize()` helper strips non-alphanumeric characters from Cloudinary folder paths |
| **Body size limit** | 10MB limit on JSON body and URL-encoded payloads |
| **Swagger hidden in production** | Topbar disabled; documentation available at `/api-docs` |
| **Correlation IDs** | Every request tagged with unique ID for audit trail |

### 9.2 Security Gaps / Concerns

| Gap | Severity | Notes |
|---|---|---|
| No email verification flow | Medium | `isEmailVerified` hardcoded to `true` (MVP shortcut) |
| No CSRF protection | Medium | Mitigated by `SameSite` cookie policy but not defense-in-depth |
| Admin role exists with no admin-only endpoints | Low | RBAC matrix defined but no admin routes implemented |
| `console.log` in auth middleware | Low | Should use structured logger |
| No account lockout after failed attempts | Medium | Rate limiting exists but no persistent lockout |
| Google OAuth client secret in env only | Low | Standard practice, but secrets rotation not documented |
| Password hash field named `passwordHash` but stored pre-hash | Low | The pre-save hook handles hashing, but the field naming is misleading on create |

---

## 10. Performance & Scalability Considerations

### 10.1 Current Optimizations

| Area | Implementation |
|---|---|
| **Database indexes** | 40+ indexes across 11 models — compound indexes for common query patterns |
| **Pagination** | All list endpoints support `page`/`limit` with metadata |
| **Select projections** | Controllers use `.select()` to avoid fetching unnecessary fields (e.g., `-passwordHash`) |
| **Lean queries** | Analytics controller uses `.lean()` for read-only queries |
| **Batch operations** | `Notification.insertMany()` for mass notifications; `PostLike` uses atomic operations |
| **Denormalization** | `memberCount`/`postCount` on CreatorPage, `likeCount`/`commentCount`/`viewCount` on Post, `lastMessage` on Conversation |
| **Redis rate limiting** | Production rate limiters backed by Redis for distributed state |
| **Socket.IO Redis adapter** | Prepared (commented out) for horizontal scaling |
| **TTL indexes** | RefreshToken and Notification auto-cleanup via MongoDB TTL |
| **Connection pooling** | Mongoose default connection pool |

### 10.2 Scalability Architecture

```
Current: Single instance monolith
         ┌────────────────┐
         │ Node.js Process │
         │ Express + Socket│
         │       ▼        │
         │  MongoDB Atlas  │
         │  Redis (optional)│
         └────────────────┘

Prepared for: Multi-instance horizontal scaling
         ┌───────────┐  ┌───────────┐  ┌───────────┐
         │ Instance 1│  │ Instance 2│  │ Instance 3│
         └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
               │               │               │
               └───────┬───────┘───────────────┘
                       ▼
               ┌──────────────┐
               │ Redis Cluster│ (rate limits, socket adapter)
               └──────────────┘
                       ▼
               ┌──────────────┐
               │ MongoDB Atlas │ (replica set)
               └──────────────┘
```

### 10.3 Bottleneck Risks

| Risk | Impact | Mitigation Path |
|---|---|---|
| In-memory `connectedUsers` Map | Socket state lost on restart; no cross-instance awareness | Migrate to Redis-backed presence |
| No query caching | Repeated reads hit MongoDB directly | Redis caching layer (feature flag `useRedisCache` exists) |
| Aggregation queries in analytics | Expensive on large datasets | Pre-computed materialized views or scheduled aggregation |
| `memberCount`/`postCount` drift | Possible on concurrent writes | Auto-fix logic exists for postCount; consider periodic reconciliation job |
| Single-threaded Node.js | CPU-bound operations block event loop | Cluster mode or PM2; offload heavy work to job queues (BullMQ stubs exist) |

---

## 11. Risks & Technical Debt

### 11.1 Architectural Debt

| Item | Impact | Location |
|---|---|---|
| **Partial service layer adoption** | Auth and notifications have proper services, but remaining controllers (post, page, membership, conversation, analytics, user, notification) contain business logic directly. This violates single-responsibility and makes unit testing harder. | `controllers/*` |
| **Mixed error handling patterns** | Some controllers use `createError.xxx()` factory, others construct raw `{ success: false, error: { code, message } }` inline. Not all controllers have migrated to the centralized error system. | Various controllers |
| **Type casting workarounds** | Multiple routes use `as unknown as RequestHandler` to work around TypeScript strictness. This hides potential type mismatches. | `routes/*` |
| **Commented-out code** | BullMQ queue initialization, notification workers, Socket.IO Redis adapter — all commented out. Indicates incomplete feature implementations or abandoned code paths. | `index.ts`, `jobs/` |
| **Console.log debugging** | Auth middleware and several controllers still use `console.log` instead of the structured `logger`. | `middleware/auth.ts`, various controllers |
| **Duplicate type definitions** | `LockedMediaAttachment`, `UnlockedPostResponse`, `LockedPostResponse` defined in both `types/index.ts` AND `utils/postAccessControl.ts` — divergence risk. | Types + utils |
| **No database transactions** | Multi-document operations (e.g., create post + increment postCount, join membership + increment memberCount + send notification) lack transaction guarantees. | Controllers |

### 11.2 Missing Features (Inferred from Schema/Code)

| Feature | Evidence | Status |
|---|---|---|
| Email verification | `isEmailVerified` field exists, hardcoded to `true` | Stubbed, not implemented |
| Password reset | `forgotPasswordSchema` and `resetPasswordSchema` exist in validators | Schemas defined, no route/controller |
| Post scheduling | `scheduledFor` field in Post model, `scheduled` status enum | Schema supports it, no cron/worker triggers publication |
| Background job processing | `jobs/queues.ts` and `jobs/workers/` directory exist | Stubs only, fully commented out |
| Audit logging | `features.enableAuditLogs` config flag exists | Flag defined, no implementation |
| Payment/Payouts | `payouts:view` permission exists | Permission defined, no payment logic |
| Content search | No search endpoint exists | Not implemented |
| Pagination cursor-based | All pagination uses offset-based (page/limit) | Works but degrades at scale |

---

## 12. Suggested Improvements

### 12.1 High Priority

| # | Improvement | Rationale |
|---|---|---|
| 1 | **Extract service layer for all features** | Move business logic from controllers (post, page, membership, conversation) into dedicated services. Controllers should only handle HTTP concerns (parsing, response shaping). Enables unit testing without HTTP context. |
| 2 | **Standardize error handling** | Migrate all inline error responses to use `createError.*` factory. Remove raw `{ success: false, error: { ... } }` construction from controllers. |
| 3 | **Add MongoDB transactions** | Wrap multi-document write operations (join + increment, create post + increment, delete + cleanup) in sessions/transactions to prevent data inconsistency. |
| 4 | **Implement email verification** | Activate the `isEmailVerified` field with token-based verification flow. |
| 5 | **Implement password reset** | Wire up `forgotPasswordSchema` / `resetPasswordSchema` with email-based reset token flow. |
| 6 | **Replace console.log with logger** | Systematically replace all `console.log` / `console.error` calls with structured `logger.info` / `logger.error`. |

### 12.2 Medium Priority

| # | Improvement | Rationale |
|---|---|---|
| 7 | **Implement post scheduling worker** | Use BullMQ (stubs exist) to automatically publish posts when `scheduledFor` datetime arrives. |
| 8 | **Add Redis caching** | Cache frequently-read data (public pages, user profiles, popular posts) behind `useRedisCache` feature flag. |
| 9 | **Cursor-based pagination** | Replace offset pagination with cursor-based (using `_id` or `createdAt`) for time-series data (posts, messages, notifications) to maintain consistency. |
| 10 | **Content search** | Add text search (MongoDB text indexes or dedicated search service) for posts and creator pages. |
| 11 | **Migrate Socket.IO to Redis adapter** | Uncomment and test the Redis adapter for Socket.IO to enable horizontal scaling. |
| 12 | **Consolidate duplicate types** | Single-source `LockedPostResponse`, `UnlockedPostResponse`, etc. from `types/index.ts`; remove duplicates from `utils/postAccessControl.ts`. |

### 12.3 Low Priority

| # | Improvement | Rationale |
|---|---|---|
| 13 | **API versioning** | Add `/api/v1/` prefix for future backward-compatible evolution. |
| 14 | **Request ID propagation** | Pass correlation ID through to Mongoose queries and external service calls for end-to-end tracing. |
| 15 | **Health check depth** | Include Redis connection status in health check, add database latency probe. |
| 16 | **Automated OpenAPI spec generation** | Currently manual Swagger annotations; consider generating from Zod schemas or a schema-first approach. |
| 17 | **Rate limiter per user-action** | Currently `createPostLimiter`, `sendMessageLimiter`, etc. are defined but not applied at route level (only `loginLimiter` and `signupLimiter` are explicitly used). |

---

## 13. Development Phases / Milestones

### Phase 1: Foundation Stabilization (Current → MVP Hardening)

**Timeline:** 2–3 weeks  
**Goals:** Eliminate technical debt, close security gaps, stabilize error handling

| Task | Priority | Effort |
|---|---|---|
| Standardize all error responses to use `createError.*` | P0 | 2 days |
| Replace all `console.log` with structured logger | P0 | 1 day |
| Fix TypeScript type casting (`as unknown as RequestHandler`) | P1 | 2 days |
| Add MongoDB transactions for multi-doc operations | P1 | 2 days |
| Consolidate duplicate type definitions | P1 | 1 day |
| Remove dead/commented-out code or document it clearly | P2 | 0.5 days |
| Add comprehensive API integration tests | P0 | 3–4 days |

### Phase 2: Feature Completion (Weeks 3–6)

**Goals:** Complete all stubbed features, enable production-grade auth

| Task | Priority | Effort |
|---|---|---|
| Email verification flow (send, confirm, resend) | P0 | 3 days |
| Password reset flow (forgot, reset, token expiry) | P0 | 2 days |
| Post scheduling worker (BullMQ) | P1 | 2 days |
| Apply all unused rate limiters to respective routes | P1 | 0.5 days |
| Content search (MongoDB text indexes) | P2 | 2 days |
| Admin panel endpoints (user management, content moderation) | P2 | 3 days |

### Phase 3: Service Layer Refactor (Weeks 6–9)

**Goals:** Proper separation of concerns, testability

| Task | Priority | Effort |
|---|---|---|
| Extract `PostService` from `postControllers.ts` | P0 | 2 days |
| Extract `PageService` from `pageController.ts` | P0 | 1 day |
| Extract `MembershipService` from `membershipController.ts` | P0 | 1 day |
| Extract `ConversationService` from `conversationController.ts` | P0 | 2 days |
| Extract `AnalyticsService` from `analyticsController.ts` | P1 | 1 day |
| Unit test all services | P0 | 3 days |

### Phase 4: Scale & Performance (Weeks 9–12)

**Goals:** Production-grade performance, horizontal scalability

| Task | Priority | Effort |
|---|---|---|
| Redis caching layer for hot data | P1 | 3 days |
| Cursor-based pagination migration | P1 | 2 days |
| Socket.IO Redis adapter activation | P0 | 1 day |
| Pre-computed analytics views | P2 | 2 days |
| Load testing and bottleneck profiling | P1 | 2 days |
| Redis-backed presence tracking | P1 | 1 day |

### Phase 5: Monetization & Growth (Weeks 12+)

**Goals:** Revenue infrastructure, growth features

| Task | Priority | Effort |
|---|---|---|
| Payment integration (Stripe) | P0 | 5 days |
| Tiered membership levels | P0 | 3 days |
| Payout system for creators | P0 | 3 days |
| Webhook system for external integrations | P2 | 2 days |
| Content recommendations engine | P2 | 3 days |
| API versioning (`/api/v1/`) | P2 | 1 day |

---

## Assumptions Made

1. **No payment system exists** — The `payouts:view` permission and MVP naming suggest monetization is planned but not implemented.
2. **Cloudinary and Mux are the only external services** — No third-party integrations for email (verification/reset not implemented), analytics, or payments.
3. **Single-database deployment** — No sharding, read replicas, or multi-region considerations currently.
4. **The project name "Suscribed"** derives from the project directory name; the Swagger config references "Patreon MVP".
5. **Google OAuth is the only social auth provider** — No other OAuth providers detected.
6. **All WebSocket events are unauthenticated-tolerant** — Socket.IO middleware allows anonymous connections by design.
7. **The `admin` role has no dedicated UI or API endpoints** — It exists in the permission matrix but no admin-specific routes are defined.

---

*End of document.*

# OpenCAI

OpenCAI is a Next.js 16 app for creating AI characters, keeping them public or private, and chatting with them through a server-side OpenAI-compatible proxy.

It uses Clerk for authentication, MongoDB for persistence, and an admin-managed provider registry so browser clients never receive provider API keys or raw endpoints.

## Features

- Clerk authentication with sign-in and sign-up routes
- First synced user becomes the sole admin in the application database
- Mongo-backed users, characters, chats, chat messages, providers, provider models, and audit logs
- Public and private character visibility rules
- Admin provider console for adding providers, testing connectivity, syncing remote models, and enabling models with checkboxes
- Streaming chat responses through a server-side route handler

## Environment

Copy `.env.example` to `.env.local` and set the following values:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
MONGODB_URI=
MONGODB_DB_NAME=opencai
APP_ENCRYPTION_KEY=
```

`APP_ENCRYPTION_KEY` must be a base64-encoded 32-byte key.

Example generation command:

```bash
openssl rand -base64 32
```

## Development

Install dependencies and run the app:

```bash
npm install
npm run dev
```

Run validation:

```bash
npm run lint
npm run build
```

## Admin bootstrap

- The first authenticated user who hits the sync path becomes `isAdmin=true` in MongoDB.
- User sync is triggered by authenticated API usage and is also available at `POST /api/users/sync`.
- Admin status is stored in MongoDB, not inferred from Clerk roles.

## App routes

- `/` landing page
- `/sign-in` Clerk sign-in
- `/sign-up` Clerk sign-up
- `/characters` character dashboard
- `/chats/[chatId]` chat page with streaming replies
- `/admin/models` admin provider and model console

## API routes

### Auth and viewer

- `POST /api/users/sync`
- `GET /api/me`

### Characters

- `GET /api/characters`
- `POST /api/characters`
- `GET /api/characters/search?query=`
- `GET /api/characters/:characterId`
- `PATCH /api/characters/:characterId`
- `DELETE /api/characters/:characterId`
- `POST /api/characters/:characterId/chats`

### Chats

- `GET /api/chats`
- `GET /api/chats/:chatId`
- `PATCH /api/chats/:chatId`
- `DELETE /api/chats/:chatId`
- `GET /api/chats/:chatId/messages`
- `POST /api/chats/:chatId/messages`

### Models

- `GET /api/models`

### Admin providers and models

- `GET /api/admin/providers`
- `POST /api/admin/providers`
- `GET /api/admin/providers/:providerId`
- `PATCH /api/admin/providers/:providerId`
- `DELETE /api/admin/providers/:providerId`
- `POST /api/admin/providers/:providerId/test`
- `POST /api/admin/providers/:providerId/sync-models`
- `GET /api/admin/models`
- `PATCH /api/admin/models/:modelId`

## Notes

- Provider API keys are encrypted at rest using `APP_ENCRYPTION_KEY`.
- User-facing model responses do not expose provider secrets or raw base URLs.
- Chat streaming currently proxies OpenAI-compatible `chat/completions` responses and persists the assistant message after the stream completes.
- The current implementation uses `proxy.ts` because Next.js 16 deprecates the older `middleware.ts` convention.

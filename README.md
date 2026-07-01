# SocialFlow AI

Production-grade monorepo foundation for SocialFlow AI.

## Stack

- Next.js 15 and React 19 frontend
- NestJS backend
- PostgreSQL with Prisma ORM
- Redis and BullMQ
- Tailwind CSS and shadcn/ui conventions
- Docker Compose for local infrastructure
- ESLint, Prettier, Husky, lint-staged, and GitHub Actions

## Getting Started

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Start local services with `docker compose up -d postgres redis`.
4. Generate Prisma client with `npm run prisma:generate -w @socialflow/database`.
5. Run the apps with `npm run dev`.

## Health Checks

- API: `GET http://localhost:4000/health`
- Web shell: `http://localhost:3000`

## Authentication And Dashboard

- Auth routes: `/login`, `/register`, `/forgot-password`, `/reset-password`, and `/verify-email`.
- Protected enterprise dashboard: `/dashboard`.
- The dashboard includes a responsive sidebar, header actions, dark mode, KPI cards, charts, activity feed, and notifications using shadcn/ui-style components.
- Protected media library: `/media-library`.
- The media library includes folders, collections, search, AI-assisted metadata search, bulk upload, drag and drop, preview, compression metadata, and tags.
- Protected scheduler: `/scheduler`.
- The scheduler includes day, week, and month views, drag-and-drop scheduling, recurring posts, bulk scheduling, time slots, and queue integration status.

## Workspace Layout

- `apps/web`: Next.js frontend.
- `apps/api`: NestJS backend.
- `packages/config`: Shared environment configuration.
- `packages/database`: Prisma schema and Prisma client wrapper.
- `packages/logger`: Shared structured logging utilities.
- `packages/queue`: BullMQ queue factory.

Business features intentionally have not been implemented yet.

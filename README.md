# pilates-manager

Backend SaaS for Pilates studio management. This repository currently contains only the backend.

## Prerequisites

- Node.js LTS
- pnpm through Corepack
- Docker and Docker Compose

## Setup

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
cp .env.example .env
docker compose up -d
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev
```

Swagger: `http://localhost:3000/docs`

## Main commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm prisma:validate
pnpm prisma:migrate
pnpm prisma:seed
```

## Demo credentials

The development seed creates:

- Studio e-mail: `demo@pilates.local`
- Studio password: `Demo@123456`
- Admin PIN: `9071`
- Professional PINs: `2580`, `3690`
- Reception PIN: `7410`

Demo seed must never be executed automatically in production.

## Initial production setup

For a new empty production database, create a one-time setup token:

```env
BOOTSTRAP_SETUP_TOKEN=replace-with-a-long-random-secret
```

Then call `POST /setup/demo` with header `x-setup-token`. The endpoint only works while
there are no studios in the database.

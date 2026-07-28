# Backend implementation plan

Project: `pilates-manager`

## Repository analysis

The workspace was empty when implementation started. There was no existing Git repository and no source code to preserve.

## Architecture baseline

1. Create a pnpm workspace with `apps/api`, `apps/web`, `packages/contracts`, `docs`, `prisma`, Docker Compose, environment examples, and root scripts.
2. Implement the NestJS API with strict TypeScript, Prisma, PostgreSQL, Swagger, validation, Helmet, throttling, structured logging, and centralized errors.
3. Model all MVP entities in Prisma with UUID identifiers, tenant isolation by `studioId`, soft-delete fields where required, decimal financial values, and UTC timestamps.
4. Implement authentication in two layers:
   - device session bound to a studio after e-mail and password;
   - individual staff session after PIN unlock, with rotating refresh tokens.
5. Implement guards/decorators for JWT authentication, device authentication, studio scoping, and granular permissions.
6. Build modules incrementally:
   - health, prisma, config, audit;
   - auth, permissions, studios, staff, devices;
   - units, rooms, students, plans, payments;
   - recurring schedules, class sessions, bookings, attendance, replacement credits, waiting list;
   - assessment templates, assessments, files, dashboard.
7. Add tests for authentication, tenant isolation, permissions, capacity, replacement credits, assessments, and finance.
8. Keep documentation updated in `docs`.

## Validation cadence

After each relevant step run:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

For database changes:

- `pnpm prisma:validate`
- `pnpm prisma:migrate`
- `pnpm prisma:seed`

## MVP implementation decisions

- Multi-tenancy is column-based. All tenant-owned tables include `studioId`.
- The API never accepts `studioId` in normal DTOs for tenant-owned writes.
- Payments use Prisma `Decimal`.
- Overdue payment status is derived in services and dashboard responses instead of being mutated by a scheduler in the MVP.
- Recurring class sessions are generated within explicit date ranges requested by API callers; no infinite generation.
- Local file storage is the development default. S3-compatible storage is represented by configuration and a storage interface for future implementation.

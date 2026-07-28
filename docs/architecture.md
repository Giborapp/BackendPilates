# Architecture

`pilates-manager` is a backend-first SaaS for Pilates studios.

## Monorepo

- `apps/api`: NestJS backend.
- `apps/web`: reserved for future frontend work.
- `packages/contracts`: reserved for shared types/contracts.
- `prisma`: database schema, migrations, and seed.
- `docs`: functional and technical documentation.

## Tenancy

Tenancy is implemented by column isolation. Studio-owned records include `studioId`, and protected services receive `studioId` from the authenticated session context. Client-provided `studioId` values are ignored for normal operations.

## Authentication

Authentication has two layers:

1. Studio device login with studio e-mail and password. This creates or recognizes a `DeviceSession`.
2. PIN unlock on the connected device. This creates a staff session with permissions and rotating refresh tokens.

Passwords, PINs, device tokens, and refresh tokens are hashed before persistence. Cookies are `HttpOnly`; `Secure` is enabled outside development.

## Authorization

Authorization uses NestJS guards and permission metadata. `ADMIN` has all permissions. Other roles receive defaults plus optional custom permissions stored on `StaffMember.permissions`.

## Audit

Important business events are recorded in `AuditLog`. Secret values are excluded from audit metadata.

## Capacity

Class booking operations run in database transactions. Active bookings that consume capacity are counted before insert/update. Overbooking requires explicit permission and creates an audit entry.

## Replacement credits

Attendance operations evaluate studio settings and create at most one replacement credit per eligible source attendance. Credit usage is transactional and links the credit to the replacement booking.

## Payments

Financial values use decimal columns. In the MVP, payment `OVERDUE` is derived at read time when a pending due date is in the past; a future scheduler can persist status if operational reporting requires it.

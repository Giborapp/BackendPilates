# Database

The database is PostgreSQL managed through Prisma.

Use:

- `pnpm prisma:validate`
- `pnpm prisma:migrate`
- `pnpm prisma:generate`
- `pnpm prisma:seed`

All identifiers are UUIDs. Tenant-owned tables include `studioId`.

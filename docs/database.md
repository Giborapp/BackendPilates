# Database

The database is PostgreSQL managed through Prisma.

Use:

- `pnpm prisma:validate`
- `pnpm prisma:migrate`
- `pnpm prisma:generate`
- `pnpm prisma:seed`

All identifiers are UUIDs. Tenant-owned tables include `studioId`.

File bytes are not stored in PostgreSQL. `FileAsset` stores only metadata,
owner references, upload status, and the generated `storageKey`. The actual
object is stored by the configured storage driver.

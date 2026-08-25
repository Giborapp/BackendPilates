# Deployment

Production deployments must provide PostgreSQL and all required secrets via environment variables.

Recommended production settings:

- `NODE_ENV=production`
- HTTPS termination before the API
- secure cookies enabled
- external S3-compatible private storage with `STORAGE_DRIVER=s3`
- no demo seed execution

## Private file storage

Production file storage requires:

- `STORAGE_DRIVER=s3`
- `FILE_UPLOAD_MAX_BYTES`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

Use a private bucket. The API issues short-lived signed URLs for upload and
download. See `docs/storage.md` for the Cloudflare R2 CORS example and manual
test flow.

Run database migrations through the deployment process with:

```bash
pnpm prisma:deploy
```

Do not run the demo seed in production and do not apply migrations manually
outside the deployment process.

## First studio bootstrap

Production does not execute the development seed automatically. For a fresh empty
database, set `BOOTSTRAP_SETUP_TOKEN` to a long random value and call
`POST /setup/demo` with the `x-setup-token` header. The endpoint refuses to run
after the first studio exists.

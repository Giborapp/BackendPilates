# Private file storage

The API stores file bytes outside PostgreSQL. PostgreSQL stores only metadata,
the generated `storageKey`, upload state, owner, size, MIME type, and audit
records.

## Drivers

- `STORAGE_DRIVER=local`: development only. Files are written under
  `LOCAL_STORAGE_PATH`.
- `STORAGE_DRIVER=s3`: production driver for S3-compatible private buckets,
  including Cloudflare R2.

Required variables:

```env
STORAGE_DRIVER=s3
FILE_UPLOAD_MAX_BYTES=10000000
S3_ENDPOINT=
S3_REGION=auto
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

Do not commit real values. `FILE_UPLOAD_MAX_BYTES` defaults to `10000000`.

## Upload flow

1. `POST /files/uploads` with owner, MIME type, size, and optional original
   name/checksum.
2. API verifies permissions and that the owner belongs to the authenticated
   studio.
3. API creates a random key:
   `studios/{studioId}/{ownerType}/{ownerId}/{uuid}.{extension}`.
4. API creates a pending `FileAsset` and returns a short-lived PUT URL.
5. Client uploads bytes directly to the signed URL.
6. Client calls `POST /files/:id/confirm`.
7. API verifies the object exists and matches declared size/type, then marks it
   available.

Allowed types: PDF, JPEG, PNG, WebP.

Studio logos use the same private storage driver through dedicated studio
endpoints. Logo uploads are owned by the authenticated studio, not by a
client-provided `studioId`, and are restricted to PNG or WebP with a 2 MB limit.

## Download and deletion

- `GET /files/:id/download` returns a short-lived GET URL.
- `DELETE /files/:id` deletes the object and marks the `FileAsset` deleted.
- `POST /files/uploads/cleanup` marks old pending uploads deleted and removes
  any objects that were partially uploaded.

Buckets must remain private. Signed URLs are not logged or stored.

## Cloudflare R2 CORS example

Configure the bucket CORS to allow the frontend origin to PUT and GET objects
through signed URLs:

```json
[
  {
    "AllowedOrigins": ["https://your-frontend.example"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["content-type", "content-length"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 300
  }
]
```

Use the actual frontend origin in production. Keep the bucket private.

## Migration and deploy

1. Deploy code with the new environment variables configured.
2. Run Prisma migrations with the production migration command only:
   `pnpm prisma:deploy`.
3. Do not run `pnpm prisma:seed` in production.
4. Verify `STORAGE_DRIVER=s3` and bucket credentials are set in the runtime
   environment.

Do not apply migrations directly against production outside the deployment
process.

## Manual test

1. Authenticate as a user with `students.update_basic`.
2. Create a student or use an existing student from the same studio.
3. Call `POST /files/uploads` with:
   - `ownerType: "STUDENT"`
   - `ownerId`
   - `mimeType: "application/pdf"`
   - `size`
4. Upload the exact bytes to the returned `uploadUrl` with PUT and matching
   `Content-Type`/`Content-Length`.
5. Call `POST /files/:id/confirm`.
6. Call `GET /files/:id/download` and fetch the returned URL before it expires.
7. Call `DELETE /files/:id` and confirm future download attempts fail.

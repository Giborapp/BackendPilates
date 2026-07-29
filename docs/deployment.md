# Deployment

Production deployments must provide PostgreSQL and all required secrets via environment variables.

Recommended production settings:

- `NODE_ENV=production`
- HTTPS termination before the API
- secure cookies enabled
- external S3-compatible storage
- no demo seed execution

## First studio bootstrap

Production does not execute the development seed automatically. For a fresh empty
database, set `BOOTSTRAP_SETUP_TOKEN` to a long random value and call
`POST /setup/demo` with the `x-setup-token` header. The endpoint refuses to run
after the first studio exists.

# Deployment

Production deployments must provide PostgreSQL and all required secrets via environment variables.

Recommended production settings:

- `NODE_ENV=production`
- HTTPS termination before the API
- secure cookies enabled
- external S3-compatible storage
- no demo seed execution

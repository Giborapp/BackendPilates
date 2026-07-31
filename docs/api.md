# API

Swagger is available at `/docs` when the API is running. The OpenAPI JSON is available at `/docs-json`.

Responses use conventional HTTP status codes. Protected routes require a bearer access token, and device routes require the device cookie.

## Public account creation

`POST /auth/studio/register` creates a studio account and initial staff PINs.

Required body fields:

- `studioName`
- `email`
- `password`
- `adminName`
- `adminPin`

Optional staff pairs:

- `professionalName` with `professionalPin`
- `receptionName` with `receptionPin`

The response matches studio login: `{ studio, deviceExpiresAt }` and sets the
`device_token` cookie. The client should redirect to PIN unlock after success.

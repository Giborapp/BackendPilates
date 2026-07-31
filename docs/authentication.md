# Authentication

## Main endpoints

- `POST /auth/studio/register`: creates a studio account, initial staff PINs, and a device session.
- `POST /auth/studio/login`: validates studio e-mail/password and creates a device session.
- `GET /auth/device/status`: returns connected studio/device status.
- `POST /auth/pin/unlock`: unlocks a staff session using a PIN.
- `POST /auth/session/refresh`: rotates refresh token and returns a new access token.
- `POST /auth/session/lock`: ends the current staff session while keeping the device connected.
- `POST /auth/studio/logout`: revokes the device and staff sessions.
- `GET /auth/me`: returns the authenticated staff member and permissions.

## Cookies

- `device_token`: device session token.
- `refresh_token`: rotating staff refresh token.

Access tokens are returned in the response body and should be kept only in memory by clients.

## Studio registration

`POST /auth/studio/register` is public and rate limited. It accepts the studio name,
studio e-mail/password, admin name/PIN, and optional professional/reception name/PIN pairs.
PINs must follow the same PIN policy used by staff management and must be unique inside
the new studio. Passwords, PINs, and device tokens are hashed before storage.

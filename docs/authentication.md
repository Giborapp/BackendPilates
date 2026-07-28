# Authentication

## Main endpoints

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

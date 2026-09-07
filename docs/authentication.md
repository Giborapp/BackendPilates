# Authentication

## Main endpoints

- `POST /auth/studio/register`: creates a studio account, a default administrator, a device session and a trial subscription.
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

`POST /auth/studio/register` is public and rate limited. The new experience accepts the
studio name, responsible CPF, studio e-mail/password, administrator PIN, optional CNPJ and
a simulated monthly plan (`STARTER` or `PROFESSIONAL`). The registration password must have
at least 6 characters, one uppercase letter and one special character. A default
administrator is created and authenticated immediately; additional staff names and PINs are
managed later by the administrator in the team area. Legacy extra staff fields remain
accepted only for compatibility with older clients.

The selected plan creates a trial `Subscription` record. Billing is intentionally simulated:
no payment provider, charge or external billing call is made. Use `GET /billing/subscription`
and the admin-only simulation endpoint `PATCH /billing/subscription/simulate` for test flows.
Passwords, PINs, refresh tokens and device tokens are hashed before storage.

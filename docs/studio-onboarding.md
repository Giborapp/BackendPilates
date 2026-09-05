# Studio onboarding and branding

Studio registration keeps the first screen short:

- studio name;
- studio e-mail;
- password;
- responsible CPF;
- administrator PIN;
- optional CNPJ;
- simulated monthly plan.

After registration, the default administrator is authenticated immediately and
the app shows a resumable onboarding assistant. Additional staff names and PINs
are managed later by the administrator in the team area. Existing studios receive
compatible defaults and can keep using the system before completing optional
fields.

## Onboarding state

`Studio.onboardingStep` stores the last saved step. `Studio.onboardingCompletedAt`
is set when the visual identity step is completed. Optional fields such as CNPJ,
address and logo do not block use.

## Endpoints

- `GET /studios/current`: returns studio profile, settings, brand color, onboarding
  state and a short-lived private logo URL when a logo exists.
- `GET /studios/onboarding`: same payload used by the assistant.
- `PATCH /studios/onboarding/profile`: saves contact, address, CNPJ and timezone.
- `PATCH /studios/onboarding/operation`: saves default duration, capacity,
  cancellation, justified absence and replacement credit settings.
- `POST /studios/onboarding/plans`: creates initial weekly plans.
- `PATCH /studios/branding`: saves one of the predefined brand colors and can
  mark onboarding as completed.
- `POST /studios/logo/uploads`: creates a pending private logo upload.
- `PUT /studios/logo/:id/content`: uploads the logo bytes through the API,
  avoiding browser access to private storage endpoints.
- `POST /studios/logo/:id/confirm`: validates the uploaded object and links it as
  the studio logo.
- `DELETE /studios/logo`: deletes the current studio logo object and clears the
  link.

All write endpoints require authenticated session data and permissions. The
client never sends `studioId`; the backend uses the authenticated session.

## Brand colors

Studios can select exactly one of these colors:

```text
#1f7a6d
#2563eb
#7c3aed
#db2777
#dc2626
#ea580c
#b7791f
#16a34a
#0891b2
#4f46e5
#0f766e
#be123c
#9333ea
#047857
#334155
```

## Logo

The logo is optional and uses the existing private storage flow. It must be PNG
or WebP and no larger than 2 MB. The bucket remains private; the frontend uploads
logo bytes to the backend, and the API writes them to the configured storage.
Display URLs remain short-lived.

`FileOwnerType.STUDIO` stores studio-owned files with `ownerId` equal to the
authenticated `studioId`. Requests that try to use another studio id are rejected.

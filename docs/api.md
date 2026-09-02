# API

Swagger is available at `/docs` when the API is running. The OpenAPI JSON is available at `/docs-json`.

Responses use conventional HTTP status codes. Protected routes require a bearer access token, and device routes require the device cookie.

## Public account creation

`POST /auth/studio/register` creates a studio account, a default administrator,
a device session and a trial subscription. The new registration flow does not
ask for staff names or PINs; those are managed by the administrator in the
team area after access is created.

Required body fields:

- `studioName`
- `email`
- `password`
- `responsibleCpf`

Optional staff pairs:

- `professionalName` with `professionalPin`
- `receptionName` with `receptionPin`

Optional account fields are `cnpj` and `subscriptionPlan` (`STARTER` or
`PROFESSIONAL`). The response includes an in-memory `accessToken` and staff
session, sets `device_token` and `refresh_token`, and redirects to onboarding.
The selected monthly plan is simulated only; it does not charge a payment.

`GET /billing/subscription` reads the current simulated subscription and
`PATCH /billing/subscription/simulate` changes its status for test flows.

The frontend only asks for the required fields on the first screen. Optional
studio profile, operation, initial plans and visual identity fields are handled
by the resumable onboarding endpoints documented in `docs/studio-onboarding.md`.

## Operational class flow

- `POST /recurring-schedules` creates a weekly class time and generates upcoming sessions.
- `PATCH /recurring-schedules/:id` edits a weekly class time.
- `POST /recurring-schedules/:id/pause` pauses a weekly class time for a number of weeks.
- `POST /recurring-schedules/:id/archive` removes a weekly class time from active use.
- `POST /recurring-schedules/:id/enrollments` adds a saved student to that weekly class time.
- `POST /bookings` adds a saved student to a class.
- `POST /attendance/mark` marks presence, absence, or justified absence.
- `GET /dashboard`, `GET /class-sessions`, and `GET /class-sessions/:id` return class bookings with attendance and student monthly lesson balance.

`GET /class-sessions`, `GET /class-sessions/:id`, and `GET /recurring-schedules`
accept either `classes.read_all` or `classes.read_own`. Users without
`classes.read_all` only receive classes assigned to their authenticated staff member.

When creating a recurring schedule, `unitId` and `roomId` are optional. If they
are omitted, the API uses the studio's first active unit and first active room.
If the studio has no active unit or room yet, the API creates a default internal
unit and room so the user can create a simple weekly class time immediately.

Students accept `monthlyLessonLimit` on create/update. `monthlyLessonsUsed` and
`monthlyLessonsRemaining` are calculated from the current month's attendance.

## Assessments and anamnesis

- `POST /assessment-templates` creates a reusable assessment/anamnesis form.
- `GET /assessment-templates` lists active forms.
- `GET /assessment-templates/:id` returns one form.
- `GET /assessments?studentId=:id` lists assessments for a student.
- `POST /assessments` records an assessment for a student.

Admins and professionals can create assessment templates. Assessment answers are
validated against the selected template fields. Rules for the three published
slots, 40-question limit, presets, audiences, and versioning are documented in
`docs/assessment-templates.md`.

## Private files

- `POST /files/uploads` creates a pending file record and returns a short-lived
  PUT URL.
- `POST /files/:id/confirm` verifies the object exists in storage and marks the
  file available.
- `GET /files/:id/download` returns a short-lived GET URL.
- `DELETE /files/:id` deletes the object and marks the file deleted.
- `POST /files/uploads/cleanup` removes stale pending uploads.

The API accepts only PDF, JPEG, PNG, and WebP. The owner must belong to the
authenticated studio. Student-owned files use student permissions; assessment
files use assessment permissions; staff files require staff management.
Studio logos use dedicated `/studios/logo/*` endpoints, are owned by the
authenticated studio, and accept only PNG or WebP up to 2 MB.

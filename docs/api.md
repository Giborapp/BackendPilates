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
The studio must have at least one active unit and room.

Students accept `monthlyLessonLimit` on create/update. `monthlyLessonsUsed` and
`monthlyLessonsRemaining` are calculated from the current month's attendance.

## Assessments and anamnesis

- `POST /assessment-templates` creates a reusable assessment/anamnesis form.
- `GET /assessment-templates` lists active forms.
- `GET /assessment-templates/:id` returns one form.
- `GET /assessments?studentId=:id` lists assessments for a student.
- `POST /assessments` records an assessment for a student.

Admins and professionals can create assessment templates. Assessment answers are
validated against the selected template fields.

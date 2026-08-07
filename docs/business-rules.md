# Business rules

See `AGENTS.md` for permanent engineering rules.

## Studio isolation

Each studio is isolated by `studioId`. All tenant-owned reads and writes must filter by the authenticated studio.

## PIN policy

PINs have four digits, are unique inside a studio, and reject obvious values such as repeated digits and ascending/descending sequences.

## Capacity

Bookings can consume class capacity depending on booking type and studio settings. Overbooking requires administrative permission.

## Weekly schedules

Operational agenda setup is based on weekly recurring schedules. A recurring schedule defines weekday, start time, duration, professional, room, and capacity. For simple class creation, room and unit can be omitted by the client; the API selects the first active studio unit and room, creating a default internal unit or room when needed. Creating a recurring schedule generates upcoming class sessions. Pausing a recurring schedule cancels future scheduled sessions during the pause window, so they do not consume student monthly lessons.

Students can be added to a single generated class session or enrolled in a recurring schedule. Recurring enrollments add the student to future generated sessions for that weekly schedule.

Weekly schedule generation uses the studio timezone. Recurring enrollments must respect
the same capacity rules as manual bookings.

## Monthly lesson balance

Students can have a monthly lesson limit. The remaining monthly balance is derived from attendance records in the current month. `PRESENT`, `ABSENT`, and `CANCELLED_LATE` consume one lesson only when the class session is not cancelled. Justified absences, in-time cancellations, and cancelled class sessions do not consume a monthly lesson.

## Automatic no-show

Booked students without attendance marked three hours after the class start are automatically marked as `ABSENT`. The backend runs this check periodically and also runs it when operational class data is loaded. The automatic operation creates an audit record.

## Replacement credits

Eligible justified absences can generate a single replacement credit. Credits expire, cannot be used twice, and must be audited.

## Assessments

Completed assessments are immutable for normal edits. Corrections must preserve history.
Admins and professionals can create reusable assessment/anamnesis templates.
Student reassessments compare saved answers from previous assessments; changed
and unchanged answers must remain visible to the user.

# Business rules

See `AGENTS.md` for permanent engineering rules.

## Studio isolation

Each studio is isolated by `studioId`. All tenant-owned reads and writes must filter by the authenticated studio.

## PIN policy

PINs have four digits, are unique inside a studio, and reject obvious values such as repeated digits and ascending/descending sequences.

## Capacity

Bookings can consume class capacity depending on booking type and studio settings. Overbooking requires administrative permission.

## Monthly lesson balance

Students can have a monthly lesson limit. The remaining monthly balance is derived from attendance records in the current month. `PRESENT`, `ABSENT`, and `CANCELLED_LATE` consume one lesson. Justified absences and in-time cancellations do not consume a monthly lesson.

## Automatic no-show

Booked students without attendance marked three hours after the class start are automatically marked as `ABSENT` when operational class data is loaded. The automatic operation creates an audit record.

## Replacement credits

Eligible justified absences can generate a single replacement credit. Credits expire, cannot be used twice, and must be audited.

## Assessments

Completed assessments are immutable for normal edits. Corrections must preserve history.

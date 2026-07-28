# Business rules

See `AGENTS.md` for permanent engineering rules.

## Studio isolation

Each studio is isolated by `studioId`. All tenant-owned reads and writes must filter by the authenticated studio.

## PIN policy

PINs have four digits, are unique inside a studio, and reject obvious values such as repeated digits and ascending/descending sequences.

## Capacity

Bookings can consume class capacity depending on booking type and studio settings. Overbooking requires administrative permission.

## Replacement credits

Eligible justified absences can generate a single replacement credit. Credits expire, cannot be used twice, and must be audited.

## Assessments

Completed assessments are immutable for normal edits. Corrections must preserve history.

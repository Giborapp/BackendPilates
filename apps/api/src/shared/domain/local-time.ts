export function startOfLocalDay(date: Date, timezone: string): Date {
  const parts = localDateParts(date, timezone);
  return zonedTimeToUtc({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 0,
    minute: 0,
    second: 0,
  }, timezone);
}

export function startOfLocalMonth(date: Date, timezone: string): Date {
  const parts = localDateParts(date, timezone);
  return zonedTimeToUtc({
    year: parts.year,
    month: parts.month,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  }, timezone);
}

export function addLocalMonths(date: Date, months: number, timezone: string): Date {
  const parts = localDateParts(date, timezone);
  return zonedTimeToUtc({
    year: parts.year,
    month: parts.month + months,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  }, timezone);
}

type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function localDateParts(
  date: Date,
  timezone: string,
): Pick<LocalDateTimeParts, 'year' | 'month' | 'day'> {
  const parts = dateTimeParts(date, timezone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function zonedTimeToUtc(parts: LocalDateTimeParts, timezone: string): Date {
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const firstGuess = new Date(localAsUtc);
  const firstOffset = timeZoneOffset(firstGuess, timezone);
  const secondGuess = new Date(localAsUtc - firstOffset);
  const secondOffset = timeZoneOffset(secondGuess, timezone);
  return new Date(localAsUtc - secondOffset);
}

function timeZoneOffset(date: Date, timezone: string): number {
  const parts = dateTimeParts(date, timezone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return zonedAsUtc - date.getTime();
}

function dateTimeParts(date: Date, timezone: string): LocalDateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const values = new Map<string, string>();
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      values.set(part.type, part.value);
    }
  }
  const hour = Number(values.get('hour') ?? '0');
  return {
    year: Number(values.get('year') ?? '0'),
    month: Number(values.get('month') ?? '1'),
    day: Number(values.get('day') ?? '1'),
    hour: hour === 24 ? 0 : hour,
    minute: Number(values.get('minute') ?? '0'),
    second: Number(values.get('second') ?? '0'),
  };
}

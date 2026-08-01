import { Weekday } from '@prisma/client';
import {
  matchingLocalDates,
  startsAtForLocalDate,
} from '../src/modules/classes/recurring-schedules.service';

describe('recurring schedule rules', () => {
  it('generates matching dates by the studio local weekday', () => {
    const dates = matchingLocalDates(
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-08-08T23:59:59.000Z'),
      Weekday.MONDAY,
      'America/Sao_Paulo',
    );

    expect(dates.map((date) => date.toISOString().slice(0, 10))).toEqual(['2026-08-03']);
  });

  it('converts local class start time to UTC using the studio timezone', () => {
    const startsAt = startsAtForLocalDate(
      new Date(Date.UTC(2026, 7, 3)),
      '08:30',
      'America/Sao_Paulo',
    );

    expect(startsAt.toISOString()).toBe('2026-08-03T11:30:00.000Z');
  });
});

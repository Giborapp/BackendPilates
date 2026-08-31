import { Weekday } from '@prisma/client';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import type { AuditService } from '../src/modules/audit/audit.service';
import type { BookingsService } from '../src/modules/classes/bookings.service';
import {
  matchingLocalDates,
  RecurringSchedulesService,
  startsAtForLocalDate,
  timeIntervalsOverlap,
} from '../src/modules/classes/recurring-schedules.service';

type ScheduleRelationsResolver = {
  resolveScheduleRelations(
    studioId: string,
    unitId: string | undefined,
    roomId: string | undefined,
    professionalId: string,
  ): Promise<{ unitId: string; roomId: string }>;
};

describe('recurring schedule rules', () => {
  it.each([
    ['08:00', 60, '09:00', 60, false],
    ['08:00', 60, '08:30', 30, true],
    ['08:00', 120, '09:00', 30, true],
    ['08:00', 30, '07:00', 120, true],
    ['08:00', 30, '08:30', 30, false],
  ])('detects partial, contained and boundary overlaps', (startA, durationA, startB, durationB, expected) => {
    expect(timeIntervalsOverlap(startA, durationA, startB, durationB)).toBe(expected);
  });

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

  it('creates a default internal unit and room when simple schedule creation has no location', async () => {
    const staffFindFirstOrThrow = jest.fn().mockResolvedValue({ id: 'professional-id' });
    const unitFindFirst = jest.fn().mockResolvedValue(null);
    const unitCreate = jest.fn().mockResolvedValue({ id: 'default-unit-id' });
    const roomFindFirst = jest.fn().mockResolvedValue(null);
    const roomCreate = jest.fn().mockResolvedValue({ id: 'default-room-id' });
    const prisma = {
      staffMember: { findFirstOrThrow: staffFindFirstOrThrow },
      unit: { findFirst: unitFindFirst, create: unitCreate },
      room: { findFirst: roomFindFirst, create: roomCreate },
    } as unknown as PrismaService;
    const service = new RecurringSchedulesService(
      prisma,
      {} as AuditService,
      {} as BookingsService,
    ) as unknown as ScheduleRelationsResolver;

    await expect(
      service.resolveScheduleRelations('studio-id', undefined, undefined, 'professional-id'),
    ).resolves.toEqual({ unitId: 'default-unit-id', roomId: 'default-room-id' });
    expect(unitCreate).toHaveBeenCalledWith({
      data: { studioId: 'studio-id', name: 'Unidade principal' },
      select: { id: true },
    });
    expect(roomCreate).toHaveBeenCalledWith({
      data: {
        studioId: 'studio-id',
        unitId: 'default-unit-id',
        name: 'Sala principal',
        defaultCapacity: 6,
      },
      select: { id: true },
    });
  });
});

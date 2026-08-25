import { AttendanceStatus } from '@prisma/client';
import {
  attendanceConsumesLesson,
  automaticNoShowThreshold,
} from '../src/modules/attendance/attendance.service';
import { startOfLocalDay, startOfLocalMonth } from '../src/shared/domain/local-time';

describe('attendance rules', () => {
  it.each([AttendanceStatus.PRESENT, AttendanceStatus.ABSENT, AttendanceStatus.CANCELLED_LATE])(
    'consumes monthly lessons for %s',
    (status) => {
      expect(attendanceConsumesLesson(status)).toBe(true);
    },
  );

  it.each([
    AttendanceStatus.JUSTIFIED_ABSENCE,
    AttendanceStatus.CANCELLED_IN_TIME,
    AttendanceStatus.CANCELLED_BY_STUDIO,
  ])('does not consume monthly lessons for %s', (status) => {
    expect(attendanceConsumesLesson(status)).toBe(false);
  });

  it('marks no-shows after a three-hour threshold', () => {
    expect(automaticNoShowThreshold(new Date('2026-08-01T15:00:00.000Z')).toISOString()).toBe(
      '2026-08-01T12:00:00.000Z',
    );
  });

  it('starts operational days in the studio timezone', () => {
    expect(
      startOfLocalDay(
        new Date('2026-08-17T02:30:00.000Z'),
        'America/Sao_Paulo',
      ).toISOString(),
    ).toBe('2026-08-16T03:00:00.000Z');
  });

  it('starts monthly lesson usage in the studio timezone', () => {
    expect(
      startOfLocalMonth(
        new Date('2026-08-01T02:30:00.000Z'),
        'America/Sao_Paulo',
      ).toISOString(),
    ).toBe('2026-07-01T03:00:00.000Z');
  });
});

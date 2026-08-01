import { AttendanceStatus } from '@prisma/client';
import {
  attendanceConsumesLesson,
  automaticNoShowThreshold,
} from '../src/modules/attendance/attendance.service';

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
});

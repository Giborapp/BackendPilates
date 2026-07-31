import { AttendanceStatus } from '@prisma/client';
import { attendanceConsumesLesson } from '../src/modules/attendance/attendance.service';

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
});

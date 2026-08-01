import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceNoShowScheduler } from './attendance-no-show.scheduler';
import { AttendanceService } from './attendance.service';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceNoShowScheduler],
  exports: [AttendanceService],
})
export class AttendanceModule {}

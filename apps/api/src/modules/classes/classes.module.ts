import { Module } from '@nestjs/common';
import { RecurringSchedulesController } from './recurring-schedules.controller';
import { ClassSessionsController } from './class-sessions.controller';
import { BookingsController } from './bookings.controller';
import { WaitingListController } from './waiting-list.controller';
import { ClassSessionsService } from './class-sessions.service';
import { BookingsService } from './bookings.service';
import { RecurringSchedulesService } from './recurring-schedules.service';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [AttendanceModule],
  controllers: [
    RecurringSchedulesController,
    ClassSessionsController,
    BookingsController,
    WaitingListController,
  ],
  providers: [ClassSessionsService, BookingsService, RecurringSchedulesService],
})
export class ClassesModule {}

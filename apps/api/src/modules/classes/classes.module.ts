import { Module } from '@nestjs/common';
import { RecurringSchedulesController } from './recurring-schedules.controller';
import { ClassSessionsController } from './class-sessions.controller';
import { BookingsController } from './bookings.controller';
import { WaitingListController } from './waiting-list.controller';

@Module({ controllers: [RecurringSchedulesController, ClassSessionsController, BookingsController, WaitingListController] })
export class ClassesModule {}

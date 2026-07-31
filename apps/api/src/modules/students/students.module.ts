import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { TrialProcessesController } from './trial-processes.controller';
import { StudentsService } from './students.service';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [AttendanceModule],
  controllers: [StudentsController, TrialProcessesController],
  providers: [StudentsService],
})
export class StudentsModule {}

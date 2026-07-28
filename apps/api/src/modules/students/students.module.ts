import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { TrialProcessesController } from './trial-processes.controller';

@Module({ controllers: [StudentsController, TrialProcessesController] })
export class StudentsModule {}

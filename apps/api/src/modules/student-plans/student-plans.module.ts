import { Module } from '@nestjs/common';
import { StudentPlansController } from './student-plans.controller';

@Module({ controllers: [StudentPlansController] })
export class StudentPlansModule {}

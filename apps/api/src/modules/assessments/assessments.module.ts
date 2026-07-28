import { Module } from '@nestjs/common';
import { AssessmentTemplatesController } from './assessment-templates.controller';
import { AssessmentsController } from './assessments.controller';

@Module({ controllers: [AssessmentTemplatesController, AssessmentsController] })
export class AssessmentsModule {}

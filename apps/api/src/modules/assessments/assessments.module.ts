import { Module } from '@nestjs/common';
import { AssessmentTemplatesController } from './assessment-templates.controller';
import { AssessmentsController } from './assessments.controller';
import { AssessmentTemplatesService } from './assessment-templates.service';

@Module({ controllers: [AssessmentTemplatesController, AssessmentsController], providers: [AssessmentTemplatesService] })
export class AssessmentsModule {}

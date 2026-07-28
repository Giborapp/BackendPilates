import { Module } from '@nestjs/common';
import { StudiosController } from './studios.controller';

@Module({ controllers: [StudiosController] })
export class StudiosModule {}

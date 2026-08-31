import { Module } from '@nestjs/common';
import { StudiosController } from './studios.controller';
import { StudiosService } from './studios.service';
import { StorageService } from '../files/storage.service';

@Module({ controllers: [StudiosController], providers: [StudiosService, StorageService] })
export class StudiosModule {}

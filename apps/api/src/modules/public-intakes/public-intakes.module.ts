import { Module } from '@nestjs/common';
import { PublicIntakesController } from './public-intakes.controller';
import { PublicIntakesService } from './public-intakes.service';
import { StorageService } from '../files/storage.service';

@Module({ controllers: [PublicIntakesController], providers: [PublicIntakesService, StorageService] })
export class PublicIntakesModule {}

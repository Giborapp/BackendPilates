import { Module } from '@nestjs/common';
import { StudioSettingsController } from './studio-settings.controller';

@Module({ controllers: [StudioSettingsController] })
export class StudioSettingsModule {}

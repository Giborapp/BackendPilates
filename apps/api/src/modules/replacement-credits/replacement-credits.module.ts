import { Module } from '@nestjs/common';
import { ReplacementCreditsController } from './replacement-credits.controller';

@Module({ controllers: [ReplacementCreditsController] })
export class ReplacementCreditsModule {}

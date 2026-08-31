import { Module } from '@nestjs/common';
import { ReplacementLinksController } from './replacement-links.controller';
import { ReplacementLinksService } from './replacement-links.service';
@Module({ controllers: [ReplacementLinksController], providers: [ReplacementLinksService] })
export class ReplacementLinksModule {}

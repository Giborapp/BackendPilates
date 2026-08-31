import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder().setTitle('pilates-manager API').setDescription('Backend API for Pilates studio management').setVersion('0.1.0').addBearerAuth().addCookieAuth('device_token').addCookieAuth('refresh_token').build();
  const document = SwaggerModule.createDocument(app, config);
  await writeFile(resolve(__dirname, '../../../docs/openapi.json'), `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();
}

void generate();

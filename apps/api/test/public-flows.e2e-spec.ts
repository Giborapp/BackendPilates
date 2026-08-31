import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { PublicIntakesService } from '../src/modules/public-intakes/public-intakes.service';
import { ReplacementLinksService } from '../src/modules/replacement-links/replacement-links.service';

describe('Public critical flows (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const publicIntakes = { getPublic: jest.fn().mockResolvedValue({ studio: { name: 'Estudio Teste', brandColor: '#123456', logo: null }, template: { name: 'Anamnese', fields: [] }, expiresAt: '2030-01-01T00:00:00.000Z', privacy: null }), submit: jest.fn().mockResolvedValue({ submitted: true }) };
    const replacementLinks = { publicDetails: jest.fn().mockResolvedValue({ studio: { name: 'Estudio Teste', brandColor: '#123456' }, expiresAt: '2030-01-01T00:00:00.000Z', creditExpiresAt: '2030-01-01T00:00:00.000Z', sessions: [{ id: '77777777-7777-4777-8777-777777777777', startsAt: '2030-01-01T12:00:00.000Z', endsAt: '2030-01-01T13:00:00.000Z', professionalName: 'Profissional Teste', remaining: 1 }] }), reserve: jest.fn().mockResolvedValue({ reserved: true, session: { startsAt: '2030-01-01T12:00:00.000Z' } }) };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue({ $connect: jest.fn(), $disconnect: jest.fn() }).overrideProvider(PublicIntakesService).useValue(publicIntakes).overrideProvider(ReplacementLinksService).useValue(replacementLinks).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  it('serves intake and replacement public paths without authentication', async () => {
    const server = app.getHttpServer() as Server;
    await request(server).get('/public/anamnese/test-token').expect(200).expect(({ body }: { body: { studio: { name: string } } }) => expect(body.studio.name).toBe('Estudio Teste'));
    await request(server).post('/public/anamnese/test-token').send({ fullName: 'Pessoa Falsa', answers: {}, privacyAccepted: true, truthfulnessAccepted: true }).expect(201);
    await request(server).get('/replacement-links/test-token').expect(200);
    await request(server).post('/replacement-links/test-token/reserve').send({ classSessionId: '77777777-7777-4777-8777-777777777777' }).expect(201);
  });
  it('protects administrative intake routes', async () => { const server = app.getHttpServer() as Server; await request(server).get('/public/intakes').expect(401); });
});

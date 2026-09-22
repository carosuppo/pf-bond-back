import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { InvitationLinkController } from './invitation-link.controller';
import { NormalizeInvitationCodeParamPipe } from './pipe/normalize-invitation-code-param.pipe';

describe('InvitationLinkController', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationLinkController],
      providers: [NormalizeInvitationCodeParamPipe],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('redirige un código válido al esquema de Bond sin sesión', async () => {
    await request(app.getHttpServer())
      .get('/invite/ABCDEF')
      .expect(302)
      .expect('Location', 'bond://invite/ABCDEF');
  });

  it('normaliza minúsculas antes de redirigir', async () => {
    await request(app.getHttpServer())
      .get('/invite/abcdef')
      .expect(302)
      .expect('Location', 'bond://invite/ABCDEF');
  });

  it('normaliza guiones antes de redirigir', async () => {
    await request(app.getHttpServer())
      .get('/invite/abc-def')
      .expect(302)
      .expect('Location', 'bond://invite/ABCDEF');
  });

  it('rechaza un código con formato inválido', async () => {
    const response = await request(app.getHttpServer())
      .get('/invite/ABC')
      .expect(400);

    expect(response.body).toMatchObject({
      message: 'El código de invitación debe tener 6 caracteres alfanuméricos.',
    });
  });

  it('no depende de autenticación ni de servicios que agreguen miembros', () => {
    expect(InvitationLinkController.length).toBe(0);
  });
});

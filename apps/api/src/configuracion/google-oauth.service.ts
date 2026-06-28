import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

@Injectable()
export class GoogleOauthService {
  constructor(private prisma: PrismaService) {}

  private client() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  getAuthUrl(): string {
    return this.client().generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
  }

  async handleCallback(code: string) {
    const oauth2Client = this.client();
    const { tokens } = await oauth2Client.getToken(code);

    const existing = await this.prisma.integracion.findFirst({ where: { proveedor: 'google-drive' } });
    if (existing) {
      await this.prisma.integracion.update({ where: { id: existing.id }, data: { conectado: true, configJson: tokens as object } });
    } else {
      await this.prisma.integracion.create({ data: { proveedor: 'google-drive', conectado: true, configJson: tokens as object } });
    }
  }

  async disconnect() {
    await this.prisma.integracion.updateMany({
      where: { proveedor: 'google-drive' },
      data: { conectado: false, configJson: Prisma.JsonNull },
    });
  }

  async isConnected(): Promise<boolean> {
    const integracion = await this.prisma.integracion.findFirst({ where: { proveedor: 'google-drive' } });
    return !!integracion?.conectado;
  }

  // Cliente autenticado con refresh automático — si Google emite un access_token
  // nuevo, lo persiste de vuelta en Integracion.configJson para la próxima vez.
  async getAuthorizedClient() {
    const integracion = await this.prisma.integracion.findFirst({ where: { proveedor: 'google-drive' } });
    if (!integracion?.conectado || !integracion.configJson) return null;

    const oauth2Client = this.client();
    oauth2Client.setCredentials(integracion.configJson as object);
    oauth2Client.on('tokens', (tokens) => {
      void this.prisma.integracion.update({
        where: { id: integracion.id },
        data: { configJson: { ...(integracion.configJson as object), ...tokens } },
      });
    });
    return oauth2Client;
  }
}

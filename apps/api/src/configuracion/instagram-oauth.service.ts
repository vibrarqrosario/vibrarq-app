import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const META_GRAPH = 'https://graph.facebook.com/v20.0';

@Injectable()
export class InstagramOauthService {
  private readonly logger = new Logger(InstagramOauthService.name);

  constructor(private prisma: PrismaService) {}

  private get appId() { return process.env.META_APP_ID ?? ''; }
  private get appSecret() { return process.env.META_APP_SECRET ?? ''; }
  private get redirectUri() { return process.env.META_REDIRECT_URI ?? `${process.env.BACKEND_URL ?? 'http://localhost:3000'}/configuracion/integraciones/instagram/callback`; }

  getAuthUrl(): string {
    const scopes = [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
      'instagram_manage_insights',
    ].join(',');

    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      scope: scopes,
      response_type: 'code',
    });

    return `https://www.facebook.com/v20.0/dialog/oauth?${params}`;
  }

  async handleCallback(code: string) {
    // 1. Obtener token corto
    const shortResp = await fetch(
      `${META_GRAPH}/oauth/access_token?${new URLSearchParams({
        client_id: this.appId,
        client_secret: this.appSecret,
        redirect_uri: this.redirectUri,
        code,
      })}`,
    );
    if (!shortResp.ok) throw new Error(`Meta token error: ${await shortResp.text()}`);
    const { access_token: shortToken } = (await shortResp.json()) as { access_token: string };

    // 2. Cambiar por token de larga duración (60 días)
    const longResp = await fetch(
      `${META_GRAPH}/oauth/access_token?${new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: this.appId,
        client_secret: this.appSecret,
        fb_exchange_token: shortToken,
      })}`,
    );
    const longData = (await longResp.json()) as { access_token: string; expires_in: number };
    const longToken = longData.access_token;

    // 3. Obtener ID de la página de Facebook vinculada
    let pageAccessToken: string | null = null;
    let instagramAccountId: string | null = null;
    try {
      const pagesResp = await fetch(`${META_GRAPH}/me/accounts?access_token=${longToken}`);
      const pagesData = (await pagesResp.json()) as { data: { id: string; access_token: string; name: string }[] };
      if (pagesData.data?.length > 0) {
        const page = pagesData.data[0];
        pageAccessToken = page.access_token;

        // 4. Obtener Instagram Business Account ID
        const igResp = await fetch(
          `${META_GRAPH}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`,
        );
        const igData = (await igResp.json()) as { instagram_business_account?: { id: string } };
        instagramAccountId = igData.instagram_business_account?.id ?? null;
      }
    } catch (e) {
      this.logger.warn('No se pudo obtener cuenta Instagram Business:', e);
    }

    // 5. Guardar en Integracion
    const configJson = {
      accessToken: longToken,
      pageAccessToken,
      instagramAccountId,
      expiresIn: longData.expires_in,
      connectedAt: new Date().toISOString(),
    };

    const existing = await this.prisma.integracion.findFirst({ where: { proveedor: 'instagram' } });
    if (existing) {
      await this.prisma.integracion.update({ where: { id: existing.id }, data: { conectado: true, configJson } });
    } else {
      await this.prisma.integracion.create({ data: { proveedor: 'instagram', conectado: true, configJson } });
    }

    return { instagramAccountId };
  }

  async isConnected(): Promise<boolean> {
    const integracion = await this.prisma.integracion.findFirst({ where: { proveedor: 'instagram' } });
    return !!integracion?.conectado;
  }

  async getConfig(): Promise<{ accessToken: string; pageAccessToken: string; instagramAccountId: string } | null> {
    const integracion = await this.prisma.integracion.findFirst({ where: { proveedor: 'instagram', conectado: true } });
    if (!integracion?.configJson) return null;
    return integracion.configJson as any;
  }

  async syncMediaMetrics() {
    const config = await this.getConfig();
    if (!config?.instagramAccountId || !config.pageAccessToken) return null;

    const fields = 'id,caption,media_type,timestamp,like_count,comments_count,impressions,reach,engagement';
    const mediaResp = await fetch(
      `${META_GRAPH}/${config.instagramAccountId}/media?fields=${fields}&access_token=${config.pageAccessToken}`,
    );
    if (!mediaResp.ok) return null;
    const data = (await mediaResp.json()) as { data: any[] };
    return data.data ?? [];
  }
}

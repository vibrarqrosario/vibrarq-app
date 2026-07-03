import { Controller, Get, Param, Patch, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { ConfiguracionService } from './configuracion.service';
import { GoogleOauthService } from './google-oauth.service';
import { InstagramOauthService } from './instagram-oauth.service';

@Roles('SOCIO', 'COMMUNITY_MANAGER')
@Controller('configuracion')
export class ConfiguracionController {
  constructor(
    private service: ConfiguracionService,
    private googleOauthService: GoogleOauthService,
    private instagramOauthService: InstagramOauthService,
  ) {}

  @Get('integraciones')
  findIntegraciones() {
    return this.service.findIntegraciones();
  }

  @Patch('integraciones/:id/toggle')
  toggleIntegracion(@Param('id') id: string) {
    return this.service.toggleIntegracion(id);
  }

  // Navegación de browser (redirect), no puede llevar el header Authorization —
  // por eso son públicas (@Roles() vacío anula el @Roles de clase también).
  // El studio tiene una sola integración de Drive (no es por-usuario).
  @Public()
  @Roles()
  @Get('integraciones/google/connect')
  connectGoogle(@Res() res: Response) {
    res.redirect(this.googleOauthService.getAuthUrl());
  }

  @Public()
  @Roles()
  @Get('integraciones/google/callback')
  async googleCallback(@Query('code') code: string, @Res() res: Response) {
    await this.googleOauthService.handleCallback(code);
    res.redirect(`${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/configuracion?drive=connected`);
  }

  @Public()
  @Roles()
  @Get('integraciones/instagram/connect')
  connectInstagram(@Res() res: Response) {
    res.redirect(this.instagramOauthService.getAuthUrl());
  }

  @Public()
  @Roles()
  @Get('integraciones/instagram/callback')
  async instagramCallback(@Query('code') code: string, @Query('error') error: string, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    if (error || !code) {
      return res.redirect(`${frontendUrl}/configuracion?instagram=error`);
    }
    try {
      await this.instagramOauthService.handleCallback(code);
      res.redirect(`${frontendUrl}/configuracion?instagram=connected`);
    } catch (e) {
      res.redirect(`${frontendUrl}/configuracion?instagram=error`);
    }
  }

  @Get('integraciones/instagram/sync')
  syncInstagram() {
    return this.instagramOauthService.syncMediaMetrics();
  }

  @Get('fuentes-costo')
  findFuentesCosto() {
    return this.service.findFuentesCosto();
  }

  @Patch('fuentes-costo/:id/activar')
  activarFuenteCosto(@Param('id') id: string) {
    return this.service.activarFuenteCosto(id);
  }

  @Get('indice-costos')
  indiceCostos() {
    return this.service.indiceCostos();
  }
}

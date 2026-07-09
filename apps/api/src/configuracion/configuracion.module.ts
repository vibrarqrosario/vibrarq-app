import { Module } from '@nestjs/common';
import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionService } from './configuracion.service';
import { GoogleOauthService } from './google-oauth.service';
import { InstagramOauthService } from './instagram-oauth.service';
import { CifrasSyncService } from './cifras-sync.service';

@Module({
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService, GoogleOauthService, InstagramOauthService, CifrasSyncService],
  exports: [GoogleOauthService, InstagramOauthService, CifrasSyncService],
})
export class ConfiguracionModule {}

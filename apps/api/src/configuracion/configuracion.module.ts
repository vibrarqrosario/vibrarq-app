import { Module } from '@nestjs/common';
import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionService } from './configuracion.service';
import { GoogleOauthService } from './google-oauth.service';
import { InstagramOauthService } from './instagram-oauth.service';

@Module({
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService, GoogleOauthService, InstagramOauthService],
  exports: [GoogleOauthService, InstagramOauthService],
})
export class ConfiguracionModule {}

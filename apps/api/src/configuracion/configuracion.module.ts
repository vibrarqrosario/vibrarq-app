import { Module } from '@nestjs/common';
import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionService } from './configuracion.service';
import { GoogleOauthService } from './google-oauth.service';

@Module({
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService, GoogleOauthService],
  exports: [GoogleOauthService],
})
export class ConfiguracionModule {}

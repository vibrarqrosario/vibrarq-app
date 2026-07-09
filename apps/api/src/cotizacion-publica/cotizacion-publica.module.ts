import { Module } from '@nestjs/common';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
import { CotizacionPublicaController } from './cotizacion-publica.controller';
import { CotizacionPublicaService } from './cotizacion-publica.service';

@Module({
  imports: [ConfiguracionModule],
  controllers: [CotizacionPublicaController],
  providers: [CotizacionPublicaService],
})
export class CotizacionPublicaModule {}

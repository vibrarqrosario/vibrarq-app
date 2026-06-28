import { Module } from '@nestjs/common';
import { CotizacionPublicaController } from './cotizacion-publica.controller';
import { CotizacionPublicaService } from './cotizacion-publica.service';

@Module({
  controllers: [CotizacionPublicaController],
  providers: [CotizacionPublicaService],
})
export class CotizacionPublicaModule {}

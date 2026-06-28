import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { CotizacionPublicaService } from './cotizacion-publica.service';
import { EnviarExactaDto } from './dto/enviar-exacta.dto';
import { EstimarDto } from './dto/estimar.dto';

@Public()
@Controller('cotizacion-publica')
export class CotizacionPublicaController {
  constructor(private service: CotizacionPublicaService) {}

  @Post('estimar')
  estimar(@Body() dto: EstimarDto) {
    return this.service.estimar(dto);
  }

  @Post('exacta')
  enviarExacta(@Body() dto: EnviarExactaDto) {
    return this.service.enviarExacta(dto);
  }
}

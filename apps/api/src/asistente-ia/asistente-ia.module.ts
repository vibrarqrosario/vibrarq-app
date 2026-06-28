import { Module } from '@nestjs/common';
import { AsistenteIaController } from './asistente-ia.controller';
import { AsistenteIaService } from './asistente-ia.service';

@Module({
  controllers: [AsistenteIaController],
  providers: [AsistenteIaService],
})
export class AsistenteIaModule {}

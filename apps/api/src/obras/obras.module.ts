import { Module } from '@nestjs/common';
import { ObrasController } from './obras.controller';
import { ObrasService } from './obras.service';
import { ObraExtrasController } from './obra-extras.controller';
import { ObraExtrasService } from './obra-extras.service';
import { ConfiguracionModule } from '../configuracion/configuracion.module';

@Module({
  imports: [ConfiguracionModule],
  controllers: [ObrasController, ObraExtrasController],
  providers: [ObrasService, ObraExtrasService],
  exports: [ObrasService],
})
export class ObrasModule {}

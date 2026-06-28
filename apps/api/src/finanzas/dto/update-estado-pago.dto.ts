import { EstadoPago } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateEstadoPagoDto {
  @IsEnum(EstadoPago)
  estado: EstadoPago;
}

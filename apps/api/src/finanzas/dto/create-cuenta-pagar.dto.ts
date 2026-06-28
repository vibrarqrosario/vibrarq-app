import { IsDateString, IsNumber, IsString } from 'class-validator';

export class CreateCuentaPagarDto {
  @IsString()
  proveedor: string;

  @IsNumber()
  monto: number;

  @IsDateString()
  vencimiento: string;
}

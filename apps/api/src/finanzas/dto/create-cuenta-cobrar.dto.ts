import { IsDateString, IsNumber, IsString } from 'class-validator';

export class CreateCuentaCobrarDto {
  @IsString()
  obraId: string;

  @IsNumber()
  monto: number;

  @IsDateString()
  vencimiento: string;
}

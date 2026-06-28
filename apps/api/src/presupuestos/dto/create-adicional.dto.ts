import { IsString } from 'class-validator';

export class CreateAdicionalDto {
  @IsString()
  nombre: string;

  @IsString()
  detalle: string;
}

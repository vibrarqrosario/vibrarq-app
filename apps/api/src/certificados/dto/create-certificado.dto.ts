import { IsString } from 'class-validator';

export class CreateCertificadoDto {
  @IsString()
  periodo: string;
}

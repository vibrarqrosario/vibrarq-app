import { IsOptional, IsString } from 'class-validator';

export class CreateAmbienteDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  nota?: string;
}

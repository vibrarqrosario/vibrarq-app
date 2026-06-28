import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateAmbienteDto {
  @IsOptional()
  @IsString()
  fotoAntes?: string;

  @IsOptional()
  @IsString()
  fotoDespues?: string;

  @IsOptional()
  @IsBoolean()
  terminado?: boolean;

  @IsOptional()
  @IsString()
  nota?: string;
}

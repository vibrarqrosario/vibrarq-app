import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator';

export class EnviarExactaDto {
  @IsString()
  nombre: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsObject()
  estimacion?: Record<string, unknown>;
}

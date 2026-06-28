import { Plataforma, PostEstado } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreatePostDto {
  @IsDateString()
  fecha: string;

  @IsString()
  tipo: string;

  @IsEnum(Plataforma)
  plataforma: Plataforma;

  @IsOptional()
  @IsEnum(PostEstado)
  estado?: PostEstado;

  @IsOptional()
  @IsString()
  asignadoId?: string;

  @IsOptional()
  @IsString()
  obraId?: string;

  @IsOptional()
  @IsString()
  prioridad?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

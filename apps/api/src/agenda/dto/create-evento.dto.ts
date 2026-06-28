import { IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateEventoDto {
  @IsString()
  tipo: string;

  @IsDateString()
  fecha: string;

  @IsOptional()
  @IsString()
  obraId?: string;

  @IsOptional()
  @IsArray()
  asignadoIds?: string[];
}

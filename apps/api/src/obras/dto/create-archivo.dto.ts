import { IsOptional, IsString } from 'class-validator';

export class CreateArchivoDto {
  @IsString()
  nombre: string;

  @IsString()
  extension: string;

  @IsOptional()
  @IsString()
  autor?: string;
}

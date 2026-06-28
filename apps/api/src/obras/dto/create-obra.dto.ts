import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateObraDto {
  @IsString()
  clienteId: string;

  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  m2?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  plantas?: number;
}

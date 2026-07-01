import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  desc?: string;

  @IsOptional()
  @IsString()
  unidad?: string;

  @IsOptional()
  @IsNumber()
  cantidad?: number;

  @IsOptional()
  @IsNumber()
  costoUnitario?: number;

  @IsOptional()
  @IsNumber()
  costoProveedor?: number;

  @IsOptional()
  @IsNumber()
  rentabilidad?: number;

  @IsOptional()
  @IsNumber()
  costoUnitarioVenta?: number;

  @IsOptional()
  @IsNumber()
  precioVenta?: number;

  @IsOptional()
  @IsNumber()
  dias?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  avance?: number;
}

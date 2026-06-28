import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateItemDto {
  @IsOptional()
  @IsNumber()
  cantidad?: number;

  @IsOptional()
  @IsNumber()
  costoProveedor?: number;

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

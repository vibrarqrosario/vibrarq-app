import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateMoodboardItemDto {
  @IsIn(['imagen', 'paleta-material', 'paleta-color', 'concepto'])
  tipo: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  hex?: string;
}

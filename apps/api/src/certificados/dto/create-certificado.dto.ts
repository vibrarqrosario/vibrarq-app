import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CertificadoItemAvanceDto {
  @IsString()
  itemId: string;

  @IsNumber()
  @Min(0)
  cantidadPresente: number;
}

export class CreateCertificadoDto {
  @IsOptional()
  @IsString()
  periodo?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificadoItemAvanceDto)
  items: CertificadoItemAvanceDto[];
}

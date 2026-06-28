import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';

class OrdenCompraItemDto {
  @IsString()
  itemId: string;

  @IsNumber()
  cantidad: number;
}

export class CreateOrdenCompraDto {
  @IsString()
  presupuestoId: string;

  @IsString()
  proveedorId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrdenCompraItemDto)
  items: OrdenCompraItemDto[];
}

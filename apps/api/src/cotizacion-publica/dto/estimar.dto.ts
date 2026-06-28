import { IsIn, IsInt, Min } from 'class-validator';

export class EstimarDto {
  @IsIn(['nueva', 'remod', 'ampliacion'])
  tipoObra: 'nueva' | 'remod' | 'ampliacion';

  @IsIn(['casa', 'depto', 'local', 'oficina', 'industria'])
  inmueble: 'casa' | 'depto' | 'local' | 'oficina' | 'industria';

  @IsInt()
  @Min(10)
  m2: number;

  @IsInt()
  @Min(1)
  plantas: number;

  @IsInt()
  @Min(0)
  banos: number;

  @IsInt()
  @Min(0)
  cocinas: number;

  @IsIn(['economica', 'estandar', 'premium'])
  term: 'economica' | 'estandar' | 'premium';
}

export type TipoObra = 'nueva' | 'remod' | 'ampliacion';
export type Inmueble = 'casa' | 'depto' | 'local' | 'oficina' | 'industria';
export type Terminacion = 'economica' | 'estandar' | 'premium';

export type EstimarInput = {
  tipoObra: TipoObra;
  inmueble: Inmueble;
  m2: number;
  plantas: number;
  banos: number;
  cocinas: number;
  term: Terminacion;
};

export type EstimarResult = {
  total: number;
  material: number;
  mano: number;
  low: number;
  high: number;
  porM2: number;
  desglose: { nombre: string; pct: number; monto: number }[];
};

export type ObraResumen = {
  id: string;
  nombre: string;
  ubicacion: string | null;
  tipo: string | null;
  m2: number | null;
  montoVenta: number;
  montoCosto: number;
  margen: number;
  margenPct: number;
  avanceGlobal: number;
  adicionalesCount: number;
};

export type ClienteConObras = {
  id: string;
  nombre: string;
  carteraTotal: number;
  obras: ObraResumen[];
};

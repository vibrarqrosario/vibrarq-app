export type Item = {
  id: string;
  codigoCifras: string;
  desc: string;
  unidad: string;
  cantidad: number;
  costoUnitario: number;
  costoProveedor: number;
  rentabilidad: number;
  precioVenta: number;
  dias: number;
  avance: number;
  ratioMaterial: number;
};

export type Etapa = { id: string; code: string; nombre: string; items: Item[] };

export type Presupuesto = {
  id: string;
  tipo: 'ORIGINAL' | 'ADICIONAL';
  numero: string;
  nombre: string;
  detalle: string | null;
  estado: 'ENVIADO' | 'PROCESO' | 'APROBADO';
  etapas: Etapa[];
  montoVenta: number;
  montoCosto: number;
  avance: number;
};

export type Cotizacion = {
  id: string;
  numero: string;
  nombre: string;
  detalle: string | null;
  tipo: 'ORIGINAL' | 'ADICIONAL';
  estado: 'ENVIADO' | 'PROCESO' | 'APROBADO';
  montoVenta: number;
  avance: number;
};

export type ObraDetalle = {
  id: string;
  nombre: string;
  ubicacion: string | null;
  tipo: string | null;
  m2: number | null;
  plantas: number | null;
  cliente: { id: string; nombre: string };
  cotizaciones: Cotizacion[];
  consolidadoMonto: number;
  consolidadoCount: number;
  adicionalCount: number;
};

export type Consolidado = { etapas: Etapa[]; montoTotal: number; adicionalesAprobados: number };

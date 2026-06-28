// Lógica de cálculo portada de activeEtapas()/budgetMonto()/budgetAvance()/computeView()
// en designs/Detalle de Obra.dc.html — mantener equivalente si cambia el prototipo.

export type ItemLike = {
  id: string;
  codigoCifras: string;
  desc: string;
  unidad: string;
  cantidad: number;
  costoProveedor: number;
  precioVenta: number;
  dias: number;
  avance: number;
  ratioMaterial: number;
};

export type EtapaLike = { id: string; code: string; nombre: string; items: ItemLike[] };
export type PresupuestoLike = { id: string; estado: string; etapas: EtapaLike[] };

export function montoVenta(presupuesto: PresupuestoLike): number {
  let v = 0;
  for (const et of presupuesto.etapas) for (const it of et.items) v += it.cantidad * it.precioVenta;
  return v;
}

export function montoCosto(presupuesto: PresupuestoLike): number {
  let v = 0;
  for (const et of presupuesto.etapas) for (const it of et.items) v += it.cantidad * it.costoProveedor;
  return v;
}

export function avancePct(presupuesto: PresupuestoLike): number {
  let venta = 0;
  let hecho = 0;
  for (const et of presupuesto.etapas)
    for (const it of et.items) {
      const sv = it.cantidad * it.precioVenta;
      venta += sv;
      hecho += sv * (it.avance / 100);
    }
  return venta ? Math.round((hecho / venta) * 100) : 0;
}

// Obra consolidada = original + adicionales APROBADO, combinados por rubro (solo lectura)
export function consolidarEtapas(presupuestosAprobados: PresupuestoLike[]): EtapaLike[] {
  const merged = new Map<string, EtapaLike>();
  const orden: string[] = [];
  for (const p of presupuestosAprobados) {
    for (const et of p.etapas) {
      if (!merged.has(et.code)) {
        merged.set(et.code, { id: et.code, code: et.code, nombre: et.nombre, items: [] });
        orden.push(et.code);
      }
      for (const it of et.items) merged.get(et.code)!.items.push({ ...it, id: `${p.id}-${it.id}` });
    }
  }
  return orden.sort().map((c) => merged.get(c)!);
}

// El cliente nunca ve costo de proveedor ni margen — usar antes de devolver datos a role CLIENTE.
export function sanitizeForCliente(etapas: EtapaLike[]) {
  return etapas.map((et) => ({
    ...et,
    items: et.items.map(({ costoProveedor, ratioMaterial, ...rest }) => rest),
  }));
}

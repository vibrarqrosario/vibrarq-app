import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

const CIFRAS_COSTOS_URL = 'https://www.cifrasonline.com.ar/costos/';

// Composición del precio final según Revista CIFRAS (sobre costo directo):
// Gastos Generales 25% (incluye 5% tareas profesionales) → Beneficios 15% → IVA 21%
export const CIFRAS_COMPOSICION = {
  gastosGeneralesPct: 25,
  beneficiosPct: 15,
  ivaPct: 21,
  honorariosSugeridosPct: 6,
  factorIndirectos: 1.25 * 1.15 * 1.21, // ≈ 1.7394 sobre costo directo
};

export type CifrasMeta = {
  edicion: number | null;
  fechaCierre: string | null;
  dolarBNA: number | null;
  variacionCostos: number | null;
  // Precio final por m² (incluye indirectos + IVA) por tipología
  precioM2: { A: number; B: number; C: number; D: number } | null;
  // Ratio materiales/total por tipología (de la tabla de rubros)
  ratioMaterial: { A: number; B: number; C: number; D: number } | null;
  itemsImportados: number;
  lastSync: string;
};

@Injectable()
export class CifrasSyncService {
  private readonly logger = new Logger(CifrasSyncService.name);
  private syncing = false;

  constructor(private prisma: PrismaService) {}

  async getMeta(): Promise<CifrasMeta | null> {
    const row = await this.prisma.integracion.findFirst({ where: { proveedor: 'cifras' } });
    return (row?.configJson as CifrasMeta) ?? null;
  }

  // Refresco automático: si la última sync tiene más de 25 días, resincroniza
  // en segundo plano (la revista publica una edición por mes).
  ensureFresh(): void {
    void (async () => {
      try {
        const meta = await this.getMeta();
        const stale = !meta?.lastSync || Date.now() - new Date(meta.lastSync).getTime() > 25 * 24 * 3600 * 1000;
        if (stale) await this.sync();
      } catch (e) {
        this.logger.warn(`Auto-sync CIFRAS falló: ${e}`);
      }
    })();
  }

  async sync(): Promise<CifrasMeta> {
    if (this.syncing) {
      const meta = await this.getMeta();
      if (meta) return meta;
    }
    this.syncing = true;
    try {
      return await this.doSync();
    } finally {
      this.syncing = false;
    }
  }

  private async doSync(): Promise<CifrasMeta> {
    // 1. Obtener los links a las planillas desde la página de CIFRAS
    const html = await (await fetch(CIFRAS_COSTOS_URL)).text();
    const ids = [...html.matchAll(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/g)].map((m) => m[1]);
    const unicos = [...new Set(ids)];
    if (unicos.length < 1) throw new Error('No se encontraron planillas en cifrasonline.com.ar/costos');

    // 2. Descargar y clasificar por nombre de hoja
    let wbUnitarios: XLSX.WorkBook | null = null;
    let wbTipologias: XLSX.WorkBook | null = null;
    for (const id of unicos.slice(0, 4)) {
      try {
        const resp = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
        if (!resp.ok) continue;
        const wb = XLSX.read(Buffer.from(await resp.arrayBuffer()), { type: 'buffer' });
        if (wb.SheetNames.some((n) => n.toLowerCase().includes('unitario'))) wbUnitarios = wb;
        if (wb.SheetNames.some((n) => n.toLowerCase().includes('tipol'))) wbTipologias = wb;
      } catch (e) {
        this.logger.warn(`No se pudo descargar planilla ${id}: ${e}`);
      }
    }
    if (!wbUnitarios) throw new Error('No se encontró la planilla de Costos Unitarios');

    // 3. Portada: edición, fecha de cierre, dólar, variación
    const portada = this.parsePortada(wbUnitarios) ?? this.parsePortada(wbTipologias);

    // 4. Costos unitarios → catálogo
    const itemsImportados = await this.importCostosUnitarios(wbUnitarios);

    // 5. Tipologías → precio/m² y ratio materiales
    const tip = wbTipologias ? this.parseTipologias(wbTipologias) : null;

    const meta: CifrasMeta = {
      edicion: portada?.edicion ?? null,
      fechaCierre: portada?.fechaCierre ?? null,
      dolarBNA: portada?.dolar ?? null,
      variacionCostos: portada?.variacion ?? null,
      precioM2: tip?.precioM2 ?? null,
      ratioMaterial: tip?.ratioMaterial ?? null,
      itemsImportados,
      lastSync: new Date().toISOString(),
    };

    // 6. Persistir meta + marcar fuente CIFRAS sincronizada
    const existing = await this.prisma.integracion.findFirst({ where: { proveedor: 'cifras' } });
    if (existing) {
      await this.prisma.integracion.update({ where: { id: existing.id }, data: { conectado: true, configJson: meta } });
    } else {
      await this.prisma.integracion.create({ data: { proveedor: 'cifras', conectado: true, configJson: meta } });
    }
    await this.prisma.fuenteCostoConfig.updateMany({ where: { fuente: 'CIFRAS' }, data: { lastSync: new Date() } });

    this.logger.log(`CIFRAS sync OK: edición #${meta.edicion}, ${itemsImportados} ítems`);
    return meta;
  }

  private parsePortada(wb: XLSX.WorkBook | null): { edicion: number | null; fechaCierre: string | null; dolar: number | null; variacion: number | null } | null {
    if (!wb) return null;
    const name = wb.SheetNames.find((n) => n.toLowerCase().includes('portada'));
    if (!name) return null;
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });

    let edicion: number | null = null;
    let fechaCierre: string | null = null;
    let dolar: number | null = null;
    let variacion: number | null = null;

    for (const r of rows) {
      for (let j = 0; j < r.length; j++) {
        const s = String(r[j]);
        const mEd = s.match(/Revista.*Cifras.*#\s*(\d+)/i);
        if (mEd) edicion = parseInt(mEd[1], 10);
        const mFecha = s.match(/Fecha de cierre.*?:\s*(.+)/i);
        if (mFecha) fechaCierre = mFecha[1].trim();
        const mDolar = s.match(/D[oó]lar.*?\$\/U\$S\s*([\d.,]+)/i);
        if (mDolar) dolar = parseFloat(mDolar[1].replace(/\./g, '').replace(',', '.'));
        // La variación de costos es el primer número chico en la fila del resumen
        if (typeof r[j] === 'number' && r[j] > 0 && r[j] < 0.5 && variacion === null && s.length < 25) {
          variacion = r[j] as number;
        }
      }
    }
    return { edicion, fechaCierre, dolar, variacion };
  }

  private async importCostosUnitarios(wb: XLSX.WorkBook): Promise<number> {
    const name = wb.SheetNames.find((n) => n.toLowerCase().includes('unitario'))!;
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });

    let rubroActual = '';
    let nombreRubroActual = '';
    let count = 0;
    const ops: Promise<unknown>[] = [];

    for (const r of rows) {
      const cod = String(r[0]).trim();
      if (/^\d{2}$/.test(cod)) {
        rubroActual = cod;
        nombreRubroActual = String(r[1]).trim();
        continue;
      }
      if (!/^\d{2}\.\d{2}$/.test(cod)) continue;

      const desc = String(r[1]).trim();
      const unidad = String(r[2]).trim() || 'u';
      const mat = typeof r[3] === 'number' ? r[3] : 0;
      const ejec = typeof r[4] === 'number' ? r[4] : 0;
      const total = typeof r[5] === 'number' ? r[5] : mat + ejec;
      if (!desc || total <= 0) continue; // saltar títulos y filas sin costo (ej. honorarios %)

      ops.push(
        this.prisma.catalogoCifrasItem.upsert({
          where: { codigo: cod },
          update: { desc, unidad, costoRef: total, ratioMaterial: total > 0 ? mat / total : 0.5, rubro: rubroActual, nombreRubro: nombreRubroActual, fuente: 'CIFRAS' },
          create: { codigo: cod, rubro: rubroActual, nombreRubro: nombreRubroActual, desc, unidad, costoRef: total, ratioMaterial: total > 0 ? mat / total : 0.5, fuente: 'CIFRAS' },
        }),
      );
      count++;
    }
    await Promise.all(ops);
    return count;
  }

  private parseTipologias(wb: XLSX.WorkBook): { precioM2: CifrasMeta['precioM2']; ratioMaterial: CifrasMeta['ratioMaterial'] } | null {
    const name = wb.SheetNames.find((n) => n.toLowerCase().includes('tipol'));
    if (!name) return null;
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });

    // Cada tipología ocupa un bloque de 5 columnas: A=3, B=8, C=13, D=18
    // (col base = label PRECIO/M2, col base+1 = valor)
    const bloques: { key: 'A' | 'B' | 'C' | 'D'; col: number }[] = [];
    for (const r of rows.slice(0, 8)) {
      for (let j = 0; j < r.length; j++) {
        const s = String(r[j]).trim();
        if (['A', 'B', 'C', 'D'].includes(s) && s.length === 1) bloques.push({ key: s as any, col: j });
      }
      if (bloques.length >= 4) break;
    }
    if (bloques.length === 0) return null;

    const precioM2: any = {};
    const ratioMaterial: any = {};

    for (const { key, col } of bloques) {
      // PRECIO/M2: buscar la fila que contiene el label en col y número en col+1
      for (const r of rows.slice(0, 10)) {
        if (String(r[col]).includes('PRECIO/M2') && typeof r[col + 1] === 'number') {
          precioM2[key] = r[col + 1];
          break;
        }
      }
      // ratio materiales: sumar columnas MATERIALES y TOTAL del bloque de rubros
      let mat = 0; let tot = 0;
      for (const r of rows) {
        if (typeof r[0] === 'number' && typeof r[col] === 'number' && typeof r[col + 2] === 'number') {
          mat += r[col] as number;
          tot += r[col + 2] as number;
        }
      }
      ratioMaterial[key] = tot > 0 ? mat / tot : 0.5;
    }

    return {
      precioM2: precioM2.A ? precioM2 : null,
      ratioMaterial: ratioMaterial.A ? ratioMaterial : null,
    };
  }
}

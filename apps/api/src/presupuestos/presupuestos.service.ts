import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdicionalDto } from './dto/create-adicional.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { avancePct, montoCosto, montoVenta, PresupuestoLike } from './presupuesto-calc';
import { buildPresupuestoPdf } from './presupuesto-pdf';

const PRESUPUESTO_INCLUDE = { etapas: { include: { items: true } } } as const;

@Injectable()
export class PresupuestosService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const presupuesto = await this.prisma.presupuesto.findUnique({
      where: { id },
      include: { ...PRESUPUESTO_INCLUDE, obra: true },
    });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');
    return this.withTotales(presupuesto);
  }

  private withTotales<T extends PresupuestoLike>(presupuesto: T) {
    return {
      ...presupuesto,
      montoVenta: montoVenta(presupuesto),
      montoCosto: montoCosto(presupuesto),
      avance: avancePct(presupuesto),
    };
  }

  async assertOwnership(presupuestoId: string, user: { role: string; clienteId: string | null }) {
    if (user.role !== 'CLIENTE') return;
    const presupuesto = await this.prisma.presupuesto.findUnique({
      where: { id: presupuestoId },
      include: { obra: true },
    });
    if (!presupuesto || presupuesto.obra.clienteId !== user.clienteId) {
      throw new ForbiddenException('No tenés acceso a este presupuesto');
    }
  }

  // Fija la rentabilidad objetivo del presupuesto y la aplica a todos los
  // ítems (recalcula valor de venta y subtotales de cada uno).
  async setRentabilidad(presupuestoId: string, valor: number) {
    const presupuesto = await this.prisma.presupuesto.findUnique({
      where: { id: presupuestoId },
      include: { etapas: { include: { items: true } } },
    });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');
    const rentabilidad = Math.max(0, valor);

    await this.prisma.presupuesto.update({
      where: { id: presupuestoId },
      data: { rentabilidadObjetivo: rentabilidad },
    });

    const updates: Promise<unknown>[] = [];
    for (const etapa of presupuesto.etapas) {
      for (const item of etapa.items) {
        const costoUnitarioVenta = item.costoUnitario * (1 + rentabilidad / 100);
        updates.push(
          this.prisma.item.update({
            where: { id: item.id },
            data: { rentabilidad, costoUnitarioVenta, precioVenta: costoUnitarioVenta * item.cantidad },
          }),
        );
      }
    }
    await Promise.all(updates);
    return this.findOne(presupuestoId);
  }

  // ── Planificación (Gantt) ────────────────────────────
  // Devuelve las filas del Gantt: por rubro, días del presupuesto, avance
  // certificado y los segmentos planificados (por defecto: cadena secuencial).
  async getPlan(presupuestoId: string) {
    const presupuesto = await this.prisma.presupuesto.findUnique({
      where: { id: presupuestoId },
      include: { etapas: { include: { items: true } }, obra: true },
    });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');

    const guardados = await this.prisma.planSegmento.findMany({
      where: { presupuestoId },
      orderBy: [{ etapaCode: 'asc' }, { segmento: 'asc' }],
    });
    const porEtapa = new Map<string, { segmento: number; inicio: number; dias: number }[]>();
    for (const s of guardados) {
      if (!porEtapa.has(s.etapaCode)) porEtapa.set(s.etapaCode, []);
      porEtapa.get(s.etapaCode)!.push({ segmento: s.segmento, inicio: s.inicio, dias: s.dias });
    }

    let cursor = 0;
    const filas = presupuesto.etapas
      .map((et) => {
        const items = et.items.filter((it) => it.cantidad > 0);
        const diasPresupuesto = items.reduce((s, it) => s + it.dias, 0);
        const total = items.reduce((s, it) => s + it.subTotalMaterial + it.precioVenta, 0);
        const certificado = items.reduce((s, it) => s + (it.subTotalMaterial + it.precioVenta) * (it.avance / 100), 0);
        const avancePct = total > 0 ? Math.round((certificado / total) * 100) : 0;
        return { code: et.code, nombre: et.nombre, diasPresupuesto, total, avancePct };
      })
      .filter((f) => f.total > 0)
      .map((f) => {
        const dias = Math.max(1, f.diasPresupuesto);
        const segmentos = porEtapa.get(f.code) ?? [{ segmento: 0, inicio: cursor, dias }];
        // el cursor por defecto siempre avanza según el presupuesto,
        // para que las etapas sin plan guardado queden encadenadas
        cursor += dias;
        return { ...f, segmentos };
      });

    return {
      fechaInicio: presupuesto.obra.fechaInicio?.toISOString() ?? null,
      filas,
    };
  }

  async savePlan(presupuestoId: string, segmentos: { etapaCode: string; segmento: number; inicio: number; dias: number }[]) {
    const presupuesto = await this.prisma.presupuesto.findUnique({ where: { id: presupuestoId } });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');
    await this.prisma.planSegmento.deleteMany({ where: { presupuestoId } });
    if (segmentos.length > 0) {
      await this.prisma.planSegmento.createMany({
        data: segmentos.map((s) => ({
          presupuestoId,
          etapaCode: s.etapaCode,
          segmento: s.segmento,
          inicio: Math.max(0, Math.round(s.inicio)),
          dias: Math.max(1, Math.round(s.dias)),
        })),
      });
    }
    return this.getPlan(presupuestoId);
  }

  // Genera el PDF descargable del presupuesto.
  // cliente → columnas de venta (⑨⑩) + material · proveedor → costos de ejecución (⑥⑦)
  async generarPdf(presupuestoId: string, variante: 'cliente' | 'proveedor') {
    const presupuesto = await this.prisma.presupuesto.findUnique({
      where: { id: presupuestoId },
      include: { etapas: { include: { items: true } }, obra: { include: { cliente: true } } },
    });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');

    const cifras = await this.prisma.integracion.findFirst({ where: { proveedor: 'cifras' } });
    const cifrasMeta = cifras?.configJson as { edicion?: number; fechaCierre?: string } | null;

    const conMateriales = presupuesto.etapas.some((et) => et.items.some((it) => it.subTotalMaterial > 0));
    let diasTotales = 0;
    for (const et of presupuesto.etapas) for (const it of et.items) if (it.cantidad > 0) diasTotales += it.dias;

    return buildPresupuestoPdf({
      presupuestoId,
      variante,
      numero: presupuesto.numero,
      nombre: presupuesto.nombre,
      obraNombre: presupuesto.obra.nombre,
      clienteNombre: presupuesto.obra.cliente?.nombre,
      fecha: new Date(),
      conMateriales,
      diasTotales,
      cifrasEdicion: cifrasMeta?.edicion ? `Revista CIFRAS #${cifrasMeta.edicion}${cifrasMeta.fechaCierre ? ` (cierre ${cifrasMeta.fechaCierre})` : ''}` : null,
      etapas: presupuesto.etapas.map((et) => ({
        code: et.code,
        nombre: et.nombre,
        items: et.items.map((it) => ({
          code: it.codigoCifras,
          desc: it.desc,
          unidad: it.unidad,
          cantidad: it.cantidad,
          subTotalMaterial: it.subTotalMaterial,
          precioUnitario: variante === 'proveedor' ? it.costoUnitario : it.costoUnitarioVenta,
          subtotal: variante === 'proveedor' ? it.costoProveedor : it.precioVenta,
          total: variante === 'proveedor' ? it.costoProveedor : it.subTotalMaterial + it.precioVenta,
          dias: it.dias,
        })),
      })),
    });
  }

  async updateItem(itemId: string, dto: UpdateItemDto) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Ítem no encontrado');

    const cantidad = dto.cantidad ?? item.cantidad;
    const costoMaterial = dto.costoMaterial ?? item.costoMaterial;
    const costoUnitario = dto.costoUnitario ?? item.costoUnitario;
    const rentabilidad = dto.rentabilidad ?? item.rentabilidad;

    // col 5: subtotal material
    const subTotalMaterial = costoMaterial * cantidad;
    // col 7: subtotal ejecución proveedor
    const costoProveedor = costoUnitario * cantidad;

    // col 9: valor ejecución (un) — si se edita directamente se respeta; sino recalcula con rentabilidad
    const costoUnitarioVenta = dto.costoUnitarioVenta !== undefined
      ? dto.costoUnitarioVenta
      : (dto.costoUnitario !== undefined || dto.rentabilidad !== undefined)
        ? costoUnitario * (1 + rentabilidad / 100)
        : (item.costoUnitarioVenta ?? costoUnitario * (1 + rentabilidad / 100));

    // col 10: subtotal valor ejecución
    const precioVenta = costoUnitarioVenta * cantidad;

    const updated = await this.prisma.item.update({
      where: { id: itemId },
      data: { ...dto, costoMaterial, subTotalMaterial, costoProveedor, costoUnitarioVenta, precioVenta },
    });

    // Sincronizar con el catálogo: el ítem editado queda disponible con sus
    // últimos datos para presupuestos futuros (de este cliente o de otros).
    if (dto.desc !== undefined || dto.unidad !== undefined || dto.costoMaterial !== undefined || dto.costoUnitario !== undefined) {
      const costoTotal = costoMaterial + costoUnitario;
      await this.prisma.catalogoCifrasItem.updateMany({
        where: { codigo: updated.codigoCifras },
        data: {
          ...(dto.desc !== undefined ? { desc: dto.desc } : {}),
          ...(dto.unidad !== undefined ? { unidad: dto.unidad } : {}),
          ...(dto.costoMaterial !== undefined || dto.costoUnitario !== undefined
            ? { costoVibrarq: costoUnitario, costoRef: costoTotal, ratioMaterial: costoTotal > 0 ? costoMaterial / costoTotal : 0.5 }
            : {}),
        },
      });
    }

    return updated;
  }

  async addItem(etapaId: string) {
    const etapa = await this.prisma.etapa.findUnique({ where: { id: etapaId } });
    if (!etapa) throw new NotFoundException('Etapa no encontrada');
    // Código único para que el ítem pueda persistirse en el catálogo
    // y quedar disponible en presupuestos futuros.
    const existentes = await this.prisma.catalogoCifrasItem.count({
      where: { codigo: { startsWith: `${etapa.code}.P` } },
    });
    const codigo = `${etapa.code}.P${String(existentes + 1).padStart(2, '0')}`;
    await this.prisma.catalogoCifrasItem.create({
      data: {
        codigo,
        rubro: etapa.code,
        nombreRubro: etapa.nombre,
        desc: 'Nuevo ítem',
        unidad: 'u',
        costoRef: 0,
        costoVibrarq: 0,
        ratioMaterial: 0.5,
        fuente: 'PROPIA',
      },
    });
    return this.prisma.item.create({
      data: {
        etapaId,
        codigoCifras: codigo,
        desc: 'Nuevo ítem',
        unidad: 'u',
        cantidad: 1,
        costoMaterial: 0,
        subTotalMaterial: 0,
        costoUnitario: 0,
        costoProveedor: 0,
        rentabilidad: 30,
        costoUnitarioVenta: 0,
        precioVenta: 0,
        dias: 1,
        avance: 0,
        ratioMaterial: 0.5,
      },
    });
  }

  async removeItem(itemId: string) {
    await this.prisma.item.delete({ where: { id: itemId } });
    return { ok: true };
  }

  async confirmarPresupuesto(presupuestoId: string) {
    await this.prisma.item.deleteMany({
      where: { etapa: { presupuestoId }, cantidad: 0 },
    });
    return this.prisma.presupuesto.update({
      where: { id: presupuestoId },
      data: { estado: 'APROBADO' },
      include: PRESUPUESTO_INCLUDE,
    });
  }

  async updateCostoVibrarq(codigo: string, costo: number) {
    return this.prisma.catalogoCifrasItem.update({ where: { codigo }, data: { costoVibrarq: costo } });
  }

  async aplicarFuente(presupuestoId: string, fuente: 'CIFRAS' | 'VIBRARQ') {
    const presupuesto = await this.prisma.presupuesto.findUnique({
      where: { id: presupuestoId },
      include: { etapas: { include: { items: true } } },
    });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');

    const codigos = presupuesto.etapas.flatMap((e) => e.items.map((i) => i.codigoCifras));
    const catalogo = await this.prisma.catalogoCifrasItem.findMany({ where: { codigo: { in: codigos } } });
    const mapaRef = new Map(catalogo.map((c) => [c.codigo, c]));

    const updates: Promise<unknown>[] = [];
    for (const etapa of presupuesto.etapas) {
      for (const item of etapa.items) {
        const ref = mapaRef.get(item.codigoCifras);
        if (!ref) continue;
        const rentabilidad = item.rentabilidad ?? 30;
        // costoRef = costo total (material + ejecución) según CIFRAS
        const costoRef = fuente === 'VIBRARQ' && ref.costoVibrarq != null ? ref.costoVibrarq : ref.costoRef;
        // col 4: material = costoRef × ratioMaterial
        const costoMaterial = costoRef * ref.ratioMaterial;
        const subTotalMaterial = costoMaterial * item.cantidad;
        // col 6: ejecución proveedor = costoRef × (1 - ratioMaterial)
        const costoUnitario = costoRef * (1 - ref.ratioMaterial);
        const costoProveedor = costoUnitario * item.cantidad;
        // col 9: valor ejecución venta
        const costoUnitarioVenta = costoUnitario * (1 + rentabilidad / 100);
        const precioVenta = costoUnitarioVenta * item.cantidad;
        updates.push(
          this.prisma.item.update({
            where: { id: item.id },
            data: { costoMaterial, subTotalMaterial, costoUnitario, costoProveedor, costoUnitarioVenta, precioVenta },
          }),
        );
      }
    }
    await Promise.all(updates);
    return this.findOne(presupuestoId);
  }

  async addEtapa(presupuestoId: string) {
    const presupuesto = await this.prisma.presupuesto.findUnique({ where: { id: presupuestoId }, include: { etapas: true } });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');
    const num = presupuesto.etapas.length + 1;
    const code = String(num).padStart(2, '0');
    return this.prisma.etapa.create({
      data: { presupuestoId, code, nombre: 'Nuevo rubro', items: { create: [] } },
      include: { items: true },
    });
  }

  async createAdicional(obraId: string, dto: CreateAdicionalDto) {
    const obra = await this.prisma.obra.findUnique({ where: { id: obraId } });
    if (!obra) throw new NotFoundException('Obra no encontrada');

    const totalPresupuestos = await this.prisma.presupuesto.count({ where: { obraId } });
    if (totalPresupuestos === 0) {
      return this.createOriginal(obraId, dto);
    }

    const countAdicionales = await this.prisma.presupuesto.count({ where: { obraId, tipo: 'ADICIONAL' } });
    const numero = `A-${String(countAdicionales + 1).padStart(3, '0')}`;

    const catalogo = await this.prisma.catalogoCifrasItem.findMany({ orderBy: { codigo: 'asc' } });
    const porRubro = new Map<string, typeof catalogo>();
    for (const it of catalogo) {
      if (!porRubro.has(it.rubro)) porRubro.set(it.rubro, []);
      porRubro.get(it.rubro)!.push(it);
    }

    return this.prisma.presupuesto.create({
      data: {
        obraId,
        tipo: 'ADICIONAL',
        numero,
        nombre: dto.nombre,
        detalle: dto.detalle,
        estado: 'ENVIADO',
        fecha: new Date(),
        etapas: {
          create: [...porRubro.entries()].map(([rubro, items]) => ({
            code: rubro,
            nombre: items[0].nombreRubro,
            items: {
              create: items.map((it) => ({
                codigoCifras: it.codigo,
                desc: it.desc,
                unidad: it.unidad,
                cantidad: 0,
                costoMaterial: it.costoRef * it.ratioMaterial,
                subTotalMaterial: 0,
                costoUnitario: it.costoRef * (1 - it.ratioMaterial),
                costoProveedor: 0,
                rentabilidad: 30,
                costoUnitarioVenta: it.costoRef * (1 - it.ratioMaterial) * 1.3,
                precioVenta: 0,
                dias: 0,
                avance: 0,
                ratioMaterial: it.ratioMaterial,
              })),
            },
          })),
        },
      },
      include: PRESUPUESTO_INCLUDE,
    });
  }

  private async createOriginal(obraId: string, dto: CreateAdicionalDto) {
    const catalogo = await this.prisma.catalogoCifrasItem.findMany({ orderBy: { codigo: 'asc' } });
    const porRubro = new Map<string, typeof catalogo>();
    for (const it of catalogo) {
      if (!porRubro.has(it.rubro)) porRubro.set(it.rubro, []);
      porRubro.get(it.rubro)!.push(it);
    }

    return this.prisma.presupuesto.create({
      data: {
        obraId,
        tipo: 'ORIGINAL',
        numero: 'P-001',
        nombre: dto.nombre || 'Presupuesto original',
        detalle: dto.detalle,
        estado: 'ENVIADO',
        fecha: new Date(),
        etapas: {
          create: [...porRubro.entries()].map(([rubro, items]) => ({
            code: rubro,
            nombre: items[0].nombreRubro,
            items: {
              create: items.map((it) => ({
                codigoCifras: it.codigo,
                desc: it.desc,
                unidad: it.unidad,
                cantidad: 0,
                costoMaterial: it.costoRef * it.ratioMaterial,
                subTotalMaterial: 0,
                costoUnitario: it.costoRef * (1 - it.ratioMaterial),
                costoProveedor: 0,
                rentabilidad: 30,
                costoUnitarioVenta: it.costoRef * (1 - it.ratioMaterial) * 1.3,
                precioVenta: 0,
                dias: 0,
                avance: 0,
                ratioMaterial: it.ratioMaterial,
              })),
            },
          })),
        },
      },
      include: PRESUPUESTO_INCLUDE,
    });
  }
}

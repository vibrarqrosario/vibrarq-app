import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdicionalDto } from './dto/create-adicional.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { avancePct, montoCosto, montoVenta, PresupuestoLike } from './presupuesto-calc';

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

  async updateItem(itemId: string, dto: UpdateItemDto) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Ítem no encontrado');

    const cantidad = dto.cantidad ?? item.cantidad;
    const costoUnitario = dto.costoUnitario ?? item.costoUnitario;
    const rentabilidad = dto.rentabilidad ?? item.rentabilidad;

    // subtotal proveedor = costoUnitario × cantidad
    const costoProveedor = costoUnitario * cantidad;

    // costo unitario venta: si se edita directamente, respetar; sino recalcular con rentabilidad
    const costoUnitarioVenta = dto.costoUnitarioVenta !== undefined
      ? dto.costoUnitarioVenta
      : (dto.costoUnitario !== undefined || dto.rentabilidad !== undefined)
        ? costoUnitario * (1 + rentabilidad / 100)
        : ((item as any).costoUnitarioVenta ?? costoUnitario * (1 + rentabilidad / 100));

    // subtotal venta = costoUnitarioVenta × cantidad
    const precioVenta = costoUnitarioVenta * cantidad;

    return this.prisma.item.update({
      where: { id: itemId },
      data: { ...dto, costoProveedor, costoUnitarioVenta, precioVenta },
    });
  }

  async addItem(etapaId: string) {
    const etapa = await this.prisma.etapa.findUnique({ where: { id: etapaId } });
    if (!etapa) throw new NotFoundException('Etapa no encontrada');
    return this.prisma.item.create({
      data: {
        etapaId,
        codigoCifras: `${etapa.code}.—`,
        desc: 'Nuevo ítem',
        unidad: 'u',
        cantidad: 1,
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
        const costoUnitario = fuente === 'VIBRARQ' && ref.costoVibrarq != null ? ref.costoVibrarq : ref.costoRef;
        const rentabilidad = item.rentabilidad ?? 30;
        const costoUnitarioVenta = costoUnitario * (1 + rentabilidad / 100);
        const costoProveedor = costoUnitario * item.cantidad;
        const precioVenta = costoUnitarioVenta * item.cantidad;
        updates.push(
          this.prisma.item.update({
            where: { id: item.id },
            data: { costoUnitario, costoProveedor, costoUnitarioVenta, precioVenta },
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
                costoUnitario: it.costoRef,
                costoProveedor: 0,
                rentabilidad: 30,
                costoUnitarioVenta: it.costoRef * 1.3,
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
                costoUnitario: it.costoRef,
                costoProveedor: 0,
                rentabilidad: 30,
                costoUnitarioVenta: it.costoRef * 1.3,
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

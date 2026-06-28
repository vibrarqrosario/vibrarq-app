import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  avancePct,
  consolidarEtapas,
  montoCosto,
  montoVenta,
  PresupuestoLike,
} from '../presupuestos/presupuesto-calc';
import { sanitizeForCliente } from '../presupuestos/presupuesto-calc';
import { CreateObraDto } from './dto/create-obra.dto';

const PRESUPUESTO_INCLUDE = { etapas: { include: { items: true } } } as const;

@Injectable()
export class ObrasService {
  constructor(private prisma: PrismaService) {}

  // Portal del cliente: descubrir la(s) obra(s) propias sin conocer el id.
  async findMine(clienteId: string) {
    const obras = await this.prisma.obra.findMany({ where: { clienteId }, select: { id: true, nombre: true } });
    return obras;
  }

  // Dashboard de Obras: cartera completa agrupada por cliente.
  async findAllGroupedByCliente() {
    const clientes = await this.prisma.cliente.findMany({
      include: { obras: { include: { presupuestos: { include: PRESUPUESTO_INCLUDE } } } },
    });
    return clientes.map((cliente) => {
      const obras = cliente.obras.map((obra) => this.resumenObra(obra));
      const carteraTotal = obras.reduce((s, o) => s + o.montoVenta, 0);
      return { id: cliente.id, nombre: cliente.nombre, carteraTotal, obras };
    });
  }

  private resumenObra(obra: { id: string; nombre: string; ubicacion: string | null; tipo: string | null; m2: number | null; presupuestos: PresupuestoLike[] }) {
    const aprobados = obra.presupuestos.filter((p) => p.estado === 'APROBADO');
    const montoVentaTotal = aprobados.reduce((s, p) => s + montoVenta(p), 0);
    const montoCostoTotal = aprobados.reduce((s, p) => s + montoCosto(p), 0);
    const margen = montoVentaTotal - montoCostoTotal;
    const margenPct = montoVentaTotal ? Math.round((margen / montoVentaTotal) * 100) : 0;
    const avanceGlobal = aprobados.length
      ? Math.round(aprobados.reduce((s, p) => s + avancePct(p) * montoVenta(p), 0) / (montoVentaTotal || 1))
      : 0;
    return {
      id: obra.id,
      nombre: obra.nombre,
      ubicacion: obra.ubicacion,
      tipo: obra.tipo,
      m2: obra.m2,
      montoVenta: montoVentaTotal,
      montoCosto: montoCostoTotal,
      margen,
      margenPct,
      avanceGlobal,
      adicionalesCount: obra.presupuestos.filter((p) => (p as any).tipo === 'ADICIONAL').length,
    };
  }

  async findOne(obraId: string, user: { role: string; clienteId: string | null }) {
    const obra = await this.prisma.obra.findUnique({
      where: { id: obraId },
      include: { cliente: true, presupuestos: { include: PRESUPUESTO_INCLUDE } },
    });
    if (!obra) throw new NotFoundException('Obra no encontrada');
    if (user.role === 'CLIENTE' && obra.clienteId !== user.clienteId) {
      throw new ForbiddenException('No tenés acceso a esta obra');
    }

    const cotizaciones = obra.presupuestos.map((p) => ({
      id: p.id,
      numero: p.numero,
      nombre: p.nombre,
      detalle: p.detalle,
      tipo: p.tipo,
      estado: p.estado,
      montoVenta: montoVenta(p),
      avance: avancePct(p),
    }));
    const aprobados = obra.presupuestos.filter((p) => p.estado === 'APROBADO');
    const consolidadoMonto = aprobados.reduce((s, p) => s + montoVenta(p), 0);

    return {
      id: obra.id,
      nombre: obra.nombre,
      ubicacion: obra.ubicacion,
      tipo: obra.tipo,
      m2: obra.m2,
      plantas: obra.plantas,
      cliente: { id: obra.cliente.id, nombre: obra.cliente.nombre },
      cotizaciones,
      consolidadoMonto,
      consolidadoCount: aprobados.length,
      adicionalCount: obra.presupuestos.filter((p) => p.tipo === 'ADICIONAL').length,
    };
  }

  // Obra completa consolidada = original + adicionales aprobados, combinados por rubro (solo lectura).
  async getConsolidado(obraId: string, user: { role: string; clienteId: string | null }) {
    const obra = await this.prisma.obra.findUnique({
      where: { id: obraId },
      include: { presupuestos: { include: PRESUPUESTO_INCLUDE } },
    });
    if (!obra) throw new NotFoundException('Obra no encontrada');
    if (user.role === 'CLIENTE' && obra.clienteId !== user.clienteId) {
      throw new ForbiddenException('No tenés acceso a esta obra');
    }
    const aprobados = obra.presupuestos.filter((p) => p.estado === 'APROBADO');
    const etapas = consolidarEtapas(aprobados);
    const montoTotal = etapas.reduce((s, et) => s + et.items.reduce((s2, it) => s2 + it.cantidad * it.precioVenta, 0), 0);
    return {
      etapas: user.role === 'CLIENTE' ? sanitizeForCliente(etapas) : etapas,
      montoTotal,
      adicionalesAprobados: aprobados.filter((p) => p.tipo === 'ADICIONAL').length,
    };
  }

  create(dto: CreateObraDto) {
    return this.prisma.obra.create({ data: dto });
  }
}

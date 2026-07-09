import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildCertificadoPdf } from './certificado-pdf';
import { CreateCertificadoDto } from './dto/create-certificado.dto';

@Injectable()
export class CertificadosService {
  constructor(private prisma: PrismaService) {}

  async findAllForObra(obraId: string) {
    const certs = await this.prisma.certificado.findMany({
      where: { obraId },
      orderBy: { numero: 'desc' },
      include: { pagos: { orderBy: { fecha: 'desc' } } },
    });
    return certs.map((c) => {
      const pagado = c.pagos.reduce((s, p) => s + p.monto, 0);
      return { ...c, pagado, saldo: c.totalVenta - pagado };
    });
  }

  // ── Pagos recibidos ──────────────────────────────────
  async findPagos(obraId: string) {
    return this.prisma.pago.findMany({
      where: { obraId },
      orderBy: { fecha: 'desc' },
      include: { certificado: { select: { numero: true } } },
    });
  }

  async registrarPago(obraId: string, dto: { certificadoId?: string; monto: number; medio?: string; nota?: string; fecha?: string }) {
    const obra = await this.prisma.obra.findUnique({ where: { id: obraId } });
    if (!obra) throw new NotFoundException('Obra no encontrada');
    if (!dto.monto || dto.monto <= 0) throw new BadRequestException('El monto debe ser mayor a 0');

    if (dto.certificadoId) {
      const cert = await this.prisma.certificado.findUnique({ where: { id: dto.certificadoId } });
      if (!cert || cert.obraId !== obraId) throw new NotFoundException('Certificado no encontrado en esta obra');
    }

    const pago = await this.prisma.pago.create({
      data: {
        obraId,
        certificadoId: dto.certificadoId ?? null,
        monto: dto.monto,
        medio: dto.medio,
        nota: dto.nota,
        fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
      },
    });

    if (dto.certificadoId) await this.actualizarEstadoPago(dto.certificadoId);
    return pago;
  }

  async eliminarPago(pagoId: string) {
    const pago = await this.prisma.pago.findUnique({ where: { id: pagoId } });
    if (!pago) throw new NotFoundException('Pago no encontrado');
    await this.prisma.pago.delete({ where: { id: pagoId } });
    if (pago.certificadoId) await this.actualizarEstadoPago(pago.certificadoId);
    return { ok: true };
  }

  private async actualizarEstadoPago(certificadoId: string) {
    const cert = await this.prisma.certificado.findUnique({
      where: { id: certificadoId },
      include: { pagos: true },
    });
    if (!cert) return;
    const pagado = cert.pagos.reduce((s, p) => s + p.monto, 0);
    const estadoPago = pagado >= cert.totalVenta - 0.01 ? 'PAGADO' : pagado > 0 ? 'PARCIAL' : 'PENDIENTE';
    await this.prisma.certificado.update({ where: { id: certificadoId }, data: { estadoPago } });
  }

  // Planilla base para armar el próximo certificado: ítems de presupuestos APROBADOS
  // con cantidad > 0, junto con lo ya certificado (anterior) por ítem.
  async preparar(obraId: string) {
    const obra = await this.prisma.obra.findUnique({
      where: { id: obraId },
      include: {
        cliente: true,
        presupuestos: {
          where: { estado: 'APROBADO' },
          include: { etapas: { include: { items: true } } },
        },
        certificados: { include: { items: true } },
      },
    });
    if (!obra) throw new NotFoundException('Obra no encontrada');

    // Cantidades ya certificadas por ítem (suma de "presente" de certificados anteriores)
    const anteriorPorItem = new Map<string, number>();
    for (const cert of obra.certificados) {
      for (const ci of cert.items) {
        anteriorPorItem.set(ci.itemId, (anteriorPorItem.get(ci.itemId) ?? 0) + ci.cantidadPresente);
      }
    }

    const items = obra.presupuestos.flatMap((p) =>
      p.etapas.flatMap((et) =>
        et.items
          .filter((it) => it.cantidad > 0)
          .map((it) => {
            const anterior = anteriorPorItem.get(it.id) ?? 0;
            return {
              itemId: it.id,
              presupuesto: p.numero,
              etapaCode: et.code,
              etapaNombre: et.nombre,
              codigoCifras: it.codigoCifras,
              desc: it.desc,
              unidad: it.unidad,
              cantidad: it.cantidad,
              cantidadAnterior: anterior,
              avanceAnteriorPct: it.cantidad > 0 ? Math.round((anterior / it.cantidad) * 100) : 0,
            };
          }),
      ),
    );

    return {
      numeroProximo: obra.certificados.length,
      obraNombre: obra.nombre,
      clienteNombre: obra.cliente?.nombre ?? null,
      presupuestosAprobados: obra.presupuestos.length,
      items,
    };
  }

  // Crea el certificado N con avance por cantidad. La fecha es automática (createdAt);
  // el número es secuencial por obra empezando en 0.
  async create(obraId: string, dto: CreateCertificadoDto) {
    const obra = await this.prisma.obra.findUnique({
      where: { id: obraId },
      include: {
        cliente: true,
        presupuestos: { where: { estado: 'APROBADO' }, include: { etapas: { include: { items: true } } } },
        certificados: { include: { items: true } },
      },
    });
    if (!obra) throw new NotFoundException('Obra no encontrada');
    if (obra.presupuestos.length === 0) throw new BadRequestException('La obra no tiene presupuestos aprobados');

    const avances = new Map((dto.items ?? []).map((i) => [i.itemId, i.cantidadPresente]));
    if (avances.size === 0) throw new BadRequestException('Indicá el avance de al menos un ítem');

    // Anterior acumulado por ítem
    const anteriorPorItem = new Map<string, number>();
    for (const cert of obra.certificados) {
      for (const ci of cert.items) {
        anteriorPorItem.set(ci.itemId, (anteriorPorItem.get(ci.itemId) ?? 0) + ci.cantidadPresente);
      }
    }

    const itemsObra = obra.presupuestos.flatMap((p) => p.etapas.flatMap((et) => et.items.map((it) => ({ ...it, etapaCode: et.code, etapaNombre: et.nombre }))));

    type Linea = {
      itemId: string; etapaCode: string; etapaNombre: string; codigoCifras: string; desc: string; unidad: string;
      cantidadTotal: number; cantidadAnterior: number; cantidadPresente: number;
      costoUnitario: number; costoUnitarioVenta: number; avanceAcumPct: number;
    };
    const lineas: Linea[] = [];

    for (const it of itemsObra) {
      const presente = avances.get(it.id);
      if (presente === undefined || presente <= 0) continue;
      const anterior = anteriorPorItem.get(it.id) ?? 0;
      if (anterior + presente > it.cantidad * 1.0001) {
        throw new BadRequestException(
          `"${it.desc}": el acumulado (${anterior + presente} ${it.unidad}) supera la cantidad contratada (${it.cantidad} ${it.unidad})`,
        );
      }
      lineas.push({
        itemId: it.id,
        etapaCode: it.etapaCode,
        etapaNombre: it.etapaNombre,
        codigoCifras: it.codigoCifras,
        desc: it.desc,
        unidad: it.unidad,
        cantidadTotal: it.cantidad,
        cantidadAnterior: anterior,
        cantidadPresente: presente,
        costoUnitario: it.costoUnitario,
        costoUnitarioVenta: it.costoUnitarioVenta,
        avanceAcumPct: it.cantidad > 0 ? Math.round(((anterior + presente) / it.cantidad) * 100) : 0,
      });
    }
    if (lineas.length === 0) throw new BadRequestException('Ningún ítem con avance válido');

    const totalCosto = lineas.reduce((s, l) => s + l.costoUnitario * l.cantidadPresente, 0);
    const totalVenta = lineas.reduce((s, l) => s + l.costoUnitarioVenta * l.cantidadPresente, 0);

    const numero = obra.certificados.length;
    const fecha = new Date();
    const periodo = dto.periodo?.trim() || fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    const certificado = await this.prisma.certificado.create({
      data: {
        obraId,
        numero,
        periodo,
        totalCosto,
        totalVenta,
        items: {
          create: lineas.map((l) => ({
            itemId: l.itemId,
            cantidadTotal: l.cantidadTotal,
            cantidadAnterior: l.cantidadAnterior,
            cantidadPresente: l.cantidadPresente,
            avance: l.avanceAcumPct,
            costo: l.costoUnitario * l.cantidadPresente,
            venta: l.costoUnitarioVenta * l.cantidadPresente,
          })),
        },
      },
    });

    // Actualizar % de avance acumulado en cada ítem (lo usa la planificación)
    await Promise.all(
      lineas.map((l) => this.prisma.item.update({ where: { id: l.itemId }, data: { avance: l.avanceAcumPct } })),
    );

    // Ordenar por etapa para el PDF
    const ordenadas = [...lineas].sort((a, b) => a.etapaCode.localeCompare(b.etapaCode) || a.codigoCifras.localeCompare(b.codigoCifras));

    const pdfArgs = {
      certificadoId: certificado.id,
      obraNombre: obra.nombre,
      clienteNombre: obra.cliente?.nombre,
      numero,
      fecha,
      periodo,
    };
    // Proveedor: columnas 6-7 (costo de ejecución) · Cliente: columnas 9-10 (valor de venta)
    const pdfProveedorUrl = buildCertificadoPdf({
      ...pdfArgs,
      variante: 'proveedor',
      items: ordenadas.map((l) => ({
        code: l.codigoCifras, desc: l.desc, etapa: `${l.etapaCode} · ${l.etapaNombre}`, unidad: l.unidad,
        cantidadTotal: l.cantidadTotal, cantidadAnterior: l.cantidadAnterior, cantidadPresente: l.cantidadPresente,
        precioUnitario: l.costoUnitario,
      })),
    });
    const pdfClienteUrl = buildCertificadoPdf({
      ...pdfArgs,
      variante: 'cliente',
      items: ordenadas.map((l) => ({
        code: l.codigoCifras, desc: l.desc, etapa: `${l.etapaCode} · ${l.etapaNombre}`, unidad: l.unidad,
        cantidadTotal: l.cantidadTotal, cantidadAnterior: l.cantidadAnterior, cantidadPresente: l.cantidadPresente,
        precioUnitario: l.costoUnitarioVenta,
      })),
    });

    return this.prisma.certificado.update({
      where: { id: certificado.id },
      data: { pdfProveedorUrl, pdfClienteUrl },
    });
  }
}

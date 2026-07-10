import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCuentaCobrarDto } from './dto/create-cuenta-cobrar.dto';
import { CreateCuentaPagarDto } from './dto/create-cuenta-pagar.dto';
import { UpdateEstadoPagoDto } from './dto/update-estado-pago.dto';

@Injectable()
export class FinanzasService {
  constructor(private prisma: PrismaService) {}

  async resumen() {
    const [movimientos, cuentasCobrar, cuentasPagar, pagos, gastos, certificados] = await Promise.all([
      this.prisma.movimientoCaja.findMany(),
      this.prisma.cuentaCobrar.findMany(),
      this.prisma.cuentaPagar.findMany(),
      this.prisma.pago.findMany(),
      this.prisma.gasto.findMany({ select: { monto: true } }),
      this.prisma.certificado.findMany({ include: { pagos: true } }),
    ]);

    // Caja real = movimientos históricos + pagos recibidos − gastos cargados
    const saldoCaja =
      movimientos.reduce((s, m) => s + (m.tipo === 'INGRESO' ? m.monto : -m.monto), 0) +
      pagos.reduce((s, p) => s + p.monto, 0) -
      gastos.reduce((s, g) => s + g.monto, 0);

    // Por cobrar = cuentas por cobrar pendientes + saldos de certificados emitidos
    const saldoCertificados = certificados.reduce((s, c) => {
      const pagado = c.pagos.reduce((x, p) => x + p.monto, 0);
      return s + Math.max(0, c.totalVenta - pagado);
    }, 0);
    const porCobrar =
      cuentasCobrar.filter((c) => c.estado !== 'PAGADO').reduce((s, c) => s + c.monto, 0) + saldoCertificados;
    const porPagar = cuentasPagar.filter((c) => c.estado !== 'PAGADO').reduce((s, c) => s + c.monto, 0);
    const now = new Date();
    const vencido =
      cuentasCobrar.filter((c) => c.estado !== 'PAGADO' && c.vencimiento < now).reduce((s, c) => s + c.monto, 0) +
      cuentasPagar.filter((c) => c.estado !== 'PAGADO' && c.vencimiento < now).reduce((s, c) => s + c.monto, 0);

    // Proyección de flujo de caja a 6 meses, a partir de vencimientos de cuentas por cobrar/pagar.
    const meses: { mes: string; ingresos: number; egresos: number; saldo: number }[] = [];
    let saldoAcumulado = saldoCaja;
    for (let i = 0; i < 6; i++) {
      const ref = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ingresos = cuentasCobrar
        .filter((c) => c.vencimiento.getFullYear() === ref.getFullYear() && c.vencimiento.getMonth() === ref.getMonth())
        .reduce((s, c) => s + c.monto, 0);
      const egresos = cuentasPagar
        .filter((c) => c.vencimiento.getFullYear() === ref.getFullYear() && c.vencimiento.getMonth() === ref.getMonth())
        .reduce((s, c) => s + c.monto, 0);
      saldoAcumulado += ingresos - egresos;
      meses.push({ mes: ref.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }), ingresos, egresos, saldo: saldoAcumulado });
    }

    return { saldoCaja, porCobrar, porPagar, vencido, proyeccion: meses };
  }

  // ── Analítica del estudio (dashboard Inicio + PDF resumen de estado) ──
  async analitica() {
    const hoy = new Date();
    const inicioAnio = new Date(hoy.getFullYear(), 0, 1);

    const [obras, presupuestosAnio, pagos, gastos, certificados, cuentasPagar, planSegmentos] = await Promise.all([
      this.prisma.obra.findMany({
        include: {
          cliente: { select: { nombre: true } },
          presupuestos: { where: { estado: 'APROBADO' }, include: { etapas: { include: { items: true } } } },
        },
      }),
      this.prisma.presupuesto.findMany({ where: { fecha: { gte: inicioAnio } }, select: { fecha: true, estado: true } }),
      this.prisma.pago.findMany(),
      this.prisma.gasto.findMany({ select: { monto: true, fecha: true } }),
      this.prisma.certificado.findMany({ include: { pagos: true } }),
      this.prisma.cuentaPagar.findMany(),
      this.prisma.planSegmento.findMany(),
    ]);

    // Días hábiles transcurridos entre dos fechas
    const habilesEntre = (desde: Date, hasta: Date) => {
      let n = 0;
      const d = new Date(desde);
      d.setHours(0, 0, 0, 0);
      while (d <= hasta) {
        if (d.getDay() !== 0 && d.getDay() !== 6) n++;
        d.setDate(d.getDate() + 1);
      }
      return n;
    };

    const planPorPresupuesto = new Map<string, number>();
    for (const s of planSegmentos) {
      planPorPresupuesto.set(s.presupuestoId, Math.max(planPorPresupuesto.get(s.presupuestoId) ?? 0, s.inicio + s.dias));
    }

    type Alerta = { obraId: string; obra: string; tipo: 'RETRASO' | 'MARGEN' | 'COBRANZA'; detalle: string };
    const alertas: Alerta[] = [];

    const obrasActivas = obras
      .map((o) => {
        const items = o.presupuestos.flatMap((p) => p.etapas.flatMap((e) => e.items.filter((i) => i.cantidad > 0)));
        if (items.length === 0) return null;
        const venta = items.reduce((s, i) => s + i.subTotalMaterial + i.precioVenta, 0);
        const costo = items.reduce((s, i) => s + i.subTotalMaterial + i.costoProveedor, 0);
        const hecho = items.reduce((s, i) => s + (i.subTotalMaterial + i.precioVenta) * (i.avance / 100), 0);
        const avance = venta > 0 ? Math.round((hecho / venta) * 100) : 0;
        const margenPct = venta > 0 ? Math.round(((venta - costo) / venta) * 100) : 0;

        // Margen esperado según la rentabilidad objetivo fijada en cada presupuesto de la obra
        const ventaEsperada = o.presupuestos.reduce(
          (s, p) =>
            s +
            p.etapas
              .flatMap((e) => e.items.filter((i) => i.cantidad > 0))
              .reduce((x, i) => x + i.subTotalMaterial + i.costoUnitario * (1 + p.rentabilidadObjetivo / 100) * i.cantidad, 0),
          0,
        );
        const margenObjetivoPct = ventaEsperada > 0 ? Math.round(((ventaEsperada - costo) / ventaEsperada) * 100) : 0;

        // Plan: máximo fin de los segmentos guardados, o suma de días del presupuesto
        let diasPlan = 0;
        for (const p of o.presupuestos) {
          diasPlan += planPorPresupuesto.get(p.id) ?? p.etapas.flatMap((e) => e.items).reduce((s, i) => s + i.dias, 0);
        }

        // Avance esperado según tiempo transcurrido (si hay fecha de inicio y plan)
        let esperado: number | null = null;
        if (o.fechaInicio && diasPlan > 0 && o.fechaInicio <= hoy) {
          esperado = Math.min(100, Math.round((habilesEntre(o.fechaInicio, hoy) / diasPlan) * 100));
          if (avance < 100 && esperado - avance > 15) {
            alertas.push({ obraId: o.id, obra: o.nombre, tipo: 'RETRASO', detalle: `Avance ${avance}% vs ${esperado}% esperado según plan` });
          }
        }
        // Alerta si el margen real quedó más de 5 puntos abajo del objetivo fijado para la obra
        if (venta > 0 && margenObjetivoPct > 0 && margenPct < margenObjetivoPct - 5) {
          alertas.push({ obraId: o.id, obra: o.nombre, tipo: 'MARGEN', detalle: `Margen ${margenPct}% — objetivo de la obra ${margenObjetivoPct}%` });
        }
        return { id: o.id, nombre: o.nombre, cliente: o.cliente.nombre, avance, esperado, venta, costo, margenPct, margenObjetivoPct };
      })
      .filter((o): o is NonNullable<typeof o> => o !== null)
      .sort((a, b) => a.avance - b.avance);

    // Certificados con saldo viejo (>30 días sin cobrar del todo)
    const hace30 = new Date(hoy.getTime() - 30 * 24 * 3600 * 1000);
    const obraNombre = new Map(obras.map((o) => [o.id, o.nombre]));
    for (const c of certificados) {
      const pagado = c.pagos.reduce((s, p) => s + p.monto, 0);
      const saldo = c.totalVenta - pagado;
      if (saldo > 0.01 && c.createdAt < hace30) {
        alertas.push({
          obraId: c.obraId,
          obra: obraNombre.get(c.obraId) ?? '—',
          tipo: 'COBRANZA',
          detalle: `Certificado N° ${c.numero} con saldo $${Math.round(saldo).toLocaleString('es-AR')} hace más de 30 días`,
        });
      }
    }

    // Caja / por cobrar / por pagar
    const saldoCaja = pagos.reduce((s, p) => s + p.monto, 0) - gastos.reduce((s, g) => s + g.monto, 0);
    const porCobrar = certificados.reduce((s, c) => s + Math.max(0, c.totalVenta - c.pagos.reduce((x, p) => x + p.monto, 0)), 0);
    const porPagar = cuentasPagar.filter((c) => c.estado !== 'PAGADO').reduce((s, c) => s + c.monto, 0);

    // Presupuestos del año: enviados (todos) vs aceptados (APROBADO), por mes
    const porMes = Array.from({ length: 12 }, (_, i) => ({
      mes: new Date(hoy.getFullYear(), i, 1).toLocaleDateString('es-AR', { month: 'short' }),
      enviados: 0,
      aceptados: 0,
    }));
    for (const p of presupuestosAnio) {
      const m = p.fecha.getMonth();
      porMes[m].enviados++;
      if (p.estado === 'APROBADO') porMes[m].aceptados++;
    }
    const presupuestos = {
      anio: hoy.getFullYear(),
      enviados: presupuestosAnio.length,
      aceptados: presupuestosAnio.filter((p) => p.estado === 'APROBADO').length,
      porMes: porMes.slice(0, hoy.getMonth() + 1),
    };

    return {
      kpis: { obrasActivas: obrasActivas.filter((o) => o.avance < 100).length, saldoCaja, porCobrar, porPagar, alertas: alertas.length },
      obras: obrasActivas,
      alertas,
      presupuestos,
      cobradoAnio: pagos.filter((p) => p.fecha >= inicioAnio).reduce((s, p) => s + p.monto, 0),
      gastadoAnio: gastos.filter((g) => g.fecha >= inicioAnio).reduce((s, g) => s + g.monto, 0),
    };
  }

  // ── Gastos ───────────────────────────────────────────
  findGastos() {
    return this.prisma.gasto.findMany({
      orderBy: { fecha: 'desc' },
      select: {
        id: true, concepto: true, monto: true, fecha: true, facturaMime: true,
        obra: { select: { id: true, nombre: true, cliente: { select: { nombre: true } } } },
      },
    });
  }

  async createGasto(dto: { concepto: string; monto: number; obraId?: string; fecha?: string }, factura?: { buffer: Buffer; mimetype: string }) {
    if (!dto.concepto?.trim()) throw new BadRequestException('Indicá el concepto del gasto');
    if (!dto.monto || dto.monto <= 0) throw new BadRequestException('El monto debe ser mayor a 0');
    if (factura && factura.buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('La factura no puede superar 5 MB');
    }
    if (dto.obraId) {
      const obra = await this.prisma.obra.findUnique({ where: { id: dto.obraId } });
      if (!obra) throw new NotFoundException('Obra no encontrada');
    }
    const gasto = await this.prisma.gasto.create({
      data: {
        concepto: dto.concepto.trim(),
        monto: dto.monto,
        obraId: dto.obraId || null,
        fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
        facturaData: factura ? new Uint8Array(factura.buffer) : undefined,
        facturaMime: factura?.mimetype,
      },
      select: { id: true, concepto: true, monto: true, fecha: true, facturaMime: true, obraId: true },
    });
    return gasto;
  }

  async deleteGasto(id: string) {
    await this.prisma.gasto.delete({ where: { id } });
    return { ok: true };
  }

  async getFactura(id: string) {
    const gasto = await this.prisma.gasto.findUnique({ where: { id }, select: { facturaData: true, facturaMime: true } });
    if (!gasto?.facturaData) throw new NotFoundException('Este gasto no tiene factura adjunta');
    return { data: Buffer.from(gasto.facturaData), mime: gasto.facturaMime ?? 'application/octet-stream' };
  }

  // Todos los pagos recibidos (para la vista de movimientos)
  findPagos() {
    return this.prisma.pago.findMany({
      orderBy: { fecha: 'desc' },
      include: {
        obra: { select: { id: true, nombre: true, cliente: { select: { nombre: true } } } },
        certificado: { select: { numero: true } },
      },
    });
  }

  findCuentasCobrar() {
    return this.prisma.cuentaCobrar.findMany({ include: { obra: true }, orderBy: { vencimiento: 'asc' } });
  }

  findCuentasPagar() {
    return this.prisma.cuentaPagar.findMany({ orderBy: { vencimiento: 'asc' } });
  }

  createCuentaCobrar(dto: CreateCuentaCobrarDto) {
    return this.prisma.cuentaCobrar.create({ data: { ...dto, vencimiento: new Date(dto.vencimiento) } });
  }

  createCuentaPagar(dto: CreateCuentaPagarDto) {
    return this.prisma.cuentaPagar.create({ data: { ...dto, vencimiento: new Date(dto.vencimiento) } });
  }

  updateEstadoCobrar(id: string, dto: UpdateEstadoPagoDto) {
    return this.prisma.cuentaCobrar.update({ where: { id }, data: { estado: dto.estado } });
  }

  updateEstadoPagar(id: string, dto: UpdateEstadoPagoDto) {
    return this.prisma.cuentaPagar.update({ where: { id }, data: { estado: dto.estado } });
  }
}

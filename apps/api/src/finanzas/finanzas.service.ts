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

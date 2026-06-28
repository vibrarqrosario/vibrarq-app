import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCuentaCobrarDto } from './dto/create-cuenta-cobrar.dto';
import { CreateCuentaPagarDto } from './dto/create-cuenta-pagar.dto';
import { UpdateEstadoPagoDto } from './dto/update-estado-pago.dto';

@Injectable()
export class FinanzasService {
  constructor(private prisma: PrismaService) {}

  async resumen() {
    const [movimientos, cuentasCobrar, cuentasPagar] = await Promise.all([
      this.prisma.movimientoCaja.findMany(),
      this.prisma.cuentaCobrar.findMany(),
      this.prisma.cuentaPagar.findMany(),
    ]);

    const saldoCaja = movimientos.reduce((s, m) => s + (m.tipo === 'INGRESO' ? m.monto : -m.monto), 0);
    const porCobrar = cuentasCobrar.filter((c) => c.estado !== 'PAGADO').reduce((s, c) => s + c.monto, 0);
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

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrdenCompraDto } from './dto/create-orden-compra.dto';

const INCLUDE = { proveedor: true, items: { include: { item: true } } } as const;

@Injectable()
export class OrdenesCompraService {
  constructor(private prisma: PrismaService) {}

  findAllProveedores() {
    return this.prisma.proveedor.findMany();
  }

  findRecientes() {
    return this.prisma.ordenCompra.findMany({ include: INCLUDE, orderBy: { createdAt: 'desc' }, take: 20 });
  }

  findForPresupuesto(presupuestoId: string) {
    return this.prisma.ordenCompra.findMany({ where: { presupuestoId }, include: INCLUDE, orderBy: { createdAt: 'desc' } });
  }

  // Arma la orden agrupando los ítems tildados por el proveedor elegido y la emite (estado ENVIADA).
  async create(dto: CreateOrdenCompraDto, emitidaPorId: string) {
    const presupuesto = await this.prisma.presupuesto.findUnique({ where: { id: dto.presupuestoId } });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');
    const proveedor = await this.prisma.proveedor.findUnique({ where: { id: dto.proveedorId } });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');

    const count = await this.prisma.ordenCompra.count();
    const codigo = `OC-${String(count + 1).padStart(3, '0')}`;

    return this.prisma.ordenCompra.create({
      data: {
        codigo,
        presupuestoId: dto.presupuestoId,
        proveedorId: dto.proveedorId,
        estado: 'ENVIADA',
        emitidaPorId,
        items: { create: dto.items.map((it) => ({ itemId: it.itemId, cantidad: it.cantidad })) },
      },
      include: INCLUDE,
    });
  }

  async marcarRecibida(id: string) {
    const oc = await this.prisma.ordenCompra.findUnique({ where: { id } });
    if (!oc) throw new NotFoundException('Orden no encontrada');
    return this.prisma.ordenCompra.update({ where: { id }, data: { estado: 'RECIBIDA' } });
  }
}

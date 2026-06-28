import { NotFoundException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildCertificadoPdf } from './certificado-pdf';
import { CreateCertificadoDto } from './dto/create-certificado.dto';

@Injectable()
export class CertificadosService {
  constructor(private prisma: PrismaService) {}

  async findAllForObra(obraId: string) {
    return this.prisma.certificado.findMany({ where: { obraId }, orderBy: { createdAt: 'desc' } });
  }

  // Toma los ítems con avance>0 y cantidad>0 de TODOS los presupuestos de la obra para el período.
  async create(obraId: string, dto: CreateCertificadoDto) {
    const obra = await this.prisma.obra.findUnique({
      where: { id: obraId },
      include: { presupuestos: { include: { etapas: { include: { items: true } } } } },
    });
    if (!obra) throw new NotFoundException('Obra no encontrada');

    const itemsConAvance = obra.presupuestos.flatMap((p) =>
      p.etapas.flatMap((et) =>
        et.items
          .filter((it) => it.avance > 0 && it.cantidad > 0)
          .map((it) => ({
            itemId: it.id,
            etapaCode: et.code,
            etapaNombre: et.nombre,
            codigoCifras: it.codigoCifras,
            desc: it.desc,
            avance: it.avance,
            costo: it.cantidad * it.costoProveedor * (it.avance / 100),
            venta: it.cantidad * it.precioVenta * (it.avance / 100),
          })),
      ),
    );

    const totalCosto = itemsConAvance.reduce((s, it) => s + it.costo, 0);
    const totalVenta = itemsConAvance.reduce((s, it) => s + it.venta, 0);

    const certificado = await this.prisma.certificado.create({
      data: {
        obraId,
        periodo: dto.periodo,
        totalCosto,
        totalVenta,
        items: {
          create: itemsConAvance.map((it) => ({ itemId: it.itemId, avance: it.avance, costo: it.costo, venta: it.venta })),
        },
      },
    });

    const pdfProveedorUrl = buildCertificadoPdf({
      certificadoId: certificado.id,
      variante: 'proveedor',
      obraNombre: obra.nombre,
      periodo: dto.periodo,
      items: itemsConAvance.map((it) => ({ code: it.codigoCifras, desc: it.desc, etapa: it.etapaCode, avance: it.avance, monto: it.costo })),
      total: totalCosto,
    });
    const pdfClienteUrl = buildCertificadoPdf({
      certificadoId: certificado.id,
      variante: 'cliente',
      obraNombre: obra.nombre,
      periodo: dto.periodo,
      items: itemsConAvance.map((it) => ({ code: it.codigoCifras, desc: it.desc, etapa: it.etapaCode, avance: it.avance, monto: it.venta })),
      total: totalVenta,
    });

    return this.prisma.certificado.update({
      where: { id: certificado.id },
      data: { pdfProveedorUrl, pdfClienteUrl },
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleOauthService } from './google-oauth.service';

@Injectable()
export class ConfiguracionService {
  constructor(
    private prisma: PrismaService,
    private googleOauthService: GoogleOauthService,
  ) {}

  findIntegraciones() {
    return this.prisma.integracion.findMany();
  }

  async toggleIntegracion(id: string) {
    const integracion = await this.prisma.integracion.findUnique({ where: { id } });
    if (!integracion) throw new NotFoundException('Integración no encontrada');
    // Google Drive se conecta vía OAuth real (botón dedicado en el frontend);
    // este endpoint solo se usa para desconectar (revoca los tokens guardados).
    if (integracion.proveedor === 'google-drive' && integracion.conectado) {
      await this.googleOauthService.disconnect();
      return this.prisma.integracion.findUnique({ where: { id } });
    }
    return this.prisma.integracion.update({ where: { id }, data: { conectado: !integracion.conectado } });
  }

  findFuentesCosto() {
    return this.prisma.fuenteCostoConfig.findMany();
  }

  async activarFuenteCosto(id: string) {
    const fuente = await this.prisma.fuenteCostoConfig.findUnique({ where: { id } });
    if (!fuente) throw new NotFoundException('Fuente de costo no encontrada');
    await this.prisma.fuenteCostoConfig.updateMany({ data: { activa: false } });
    return this.prisma.fuenteCostoConfig.update({ where: { id }, data: { activa: true, lastSync: new Date() } });
  }

  // Tabla por rubro: costo de mano de obra / material promedio, según la fuente activa.
  async indiceCostos() {
    const fuenteActiva = await this.prisma.fuenteCostoConfig.findFirst({ where: { activa: true } });
    const items = await this.prisma.catalogoCifrasItem.findMany({ where: { fuente: fuenteActiva?.fuente ?? 'CIFRAS' } });

    const porRubro = new Map<string, { nombreRubro: string; manoObra: number[]; material: number[] }>();
    for (const it of items) {
      if (!porRubro.has(it.rubro)) porRubro.set(it.rubro, { nombreRubro: it.nombreRubro, manoObra: [], material: [] });
      const bucket = porRubro.get(it.rubro)!;
      bucket.manoObra.push(it.costoRef * (1 - it.ratioMaterial));
      bucket.material.push(it.costoRef * it.ratioMaterial);
    }
    const avg = (arr: number[]) => (arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0);

    return [...porRubro.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([rubro, b]) => ({
        rubro,
        nombreRubro: b.nombreRubro,
        manoObraPromedio: avg(b.manoObra),
        materialPromedio: avg(b.material),
        // mock: variación mensual ilustrativa (no hay serie histórica real todavía)
        variacionMensualPct: Math.round((Math.sin(rubro.charCodeAt(0)) * 4 + 3) * 10) / 10,
      }));
  }
}

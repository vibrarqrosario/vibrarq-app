import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnviarExactaDto } from './dto/enviar-exacta.dto';
import { EstimarDto } from './dto/estimar.dto';

// Motor de cálculo portado de calc() en designs/Portal del Cliente.dc.html
const VALOR_M2: Record<string, number> = { casa: 440000, depto: 400000, local: 380000, oficina: 360000, industria: 300000 };
const FACTOR_OBRA: Record<string, number> = { nueva: 1, remod: 0.68, ampliacion: 0.85 };
const FACTOR_PLANTAS: Record<number, number> = { 1: 1, 2: 1.05, 3: 1.1 };
const FACTOR_TERMINACION: Record<string, number> = { economica: 0.82, estandar: 1, premium: 1.38 };

const DESGLOSE_RUBROS: [string, number][] = [
  ['Honorarios profesionales', 7],
  ['Preliminares y mov. de suelo', 5],
  ['Estructura H°A°', 18],
  ['Mampostería y revoques', 14],
  ['Cubierta', 9],
  ['Instalaciones (elec / sanit / gas)', 16],
  ['Pisos y revestimientos', 15],
  ['Carpinterías y vidrios', 11],
  ['Pinturas y terminaciones', 5],
];

@Injectable()
export class CotizacionPublicaService {
  constructor(private prisma: PrismaService) {}

  estimar(dto: EstimarDto) {
    const valorM2 = VALOR_M2[dto.inmueble] ?? 400000;
    const factorObra = FACTOR_OBRA[dto.tipoObra] ?? 1;
    const factorPlantas = FACTOR_PLANTAS[dto.plantas] ?? 1.1;
    const factorTerm = FACTOR_TERMINACION[dto.term] ?? 1;

    const base = dto.m2 * valorM2 * factorObra * factorPlantas * factorTerm;
    const extras = dto.banos * 2_800_000 + dto.cocinas * 3_600_000;
    const total = base + extras;

    const desglose = DESGLOSE_RUBROS.map(([nombre, pct]) => ({ nombre, pct, monto: (total * pct) / 100 }));

    return {
      total,
      material: total * 0.57,
      mano: total * 0.43,
      low: total * 0.92,
      high: total * 1.08,
      porM2: dto.m2 ? total / dto.m2 : 0,
      desglose,
    };
  }

  enviarExacta(dto: EnviarExactaDto) {
    return this.prisma.cotizacionLead.create({
      data: {
        nombre: dto.nombre,
        email: dto.email,
        telefono: dto.telefono,
        ubicacion: dto.ubicacion,
        descripcion: dto.descripcion,
        estimacionJson: dto.estimacion ? JSON.stringify(dto.estimacion) : undefined,
      },
    });
  }
}

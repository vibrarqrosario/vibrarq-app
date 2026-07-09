import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CifrasSyncService, CIFRAS_COMPOSICION } from '../configuracion/cifras-sync.service';
import { EnviarExactaDto } from './dto/enviar-exacta.dto';
import { EstimarDto } from './dto/estimar.dto';

// Fallback si nunca se sincronizó CIFRAS (valores edición #364, jun-2026)
const FALLBACK_M2 = { A: 2509418, B: 2503111, C: 2299547, D: 1294149 };
const FALLBACK_RATIO = { A: 0.47, B: 0.47, C: 0.47, D: 0.45 };

const FACTOR_OBRA: Record<string, number> = { nueva: 1, remod: 0.68, ampliacion: 0.85 };
const FACTOR_TERMINACION: Record<string, number> = { economica: 0.82, estandar: 1, premium: 1.38 };

const DESGLOSE_RUBROS: [string, number][] = [
  ['Preliminares y mov. de suelo', 6],
  ['Estructura H°A°', 15],
  ['Mampostería y revoques', 20],
  ['Cubierta', 8],
  ['Instalaciones (elec / sanit / gas)', 14],
  ['Pisos y revestimientos', 12],
  ['Carpinterías y vidrios', 14],
  ['Pinturas y terminaciones', 8],
  ['Varios y equipamiento', 3],
];

@Injectable()
export class CotizacionPublicaService {
  constructor(
    private prisma: PrismaService,
    private cifrasSync: CifrasSyncService,
  ) {}

  // Mapa inmueble → tipología CIFRAS:
  // A = vivienda dúplex (2 plantas) · B = vivienda en PB · C = edificio en altura · D = galpón/depósito
  private tipologiaPara(inmueble: string, plantas: number): 'A' | 'B' | 'C' | 'D' {
    if (inmueble === 'industria') return 'D';
    if (inmueble === 'depto' || inmueble === 'oficina') return 'C';
    if (inmueble === 'local') return plantas >= 2 ? 'A' : 'B';
    return plantas >= 2 ? 'A' : 'B'; // casa
  }

  async estimar(dto: EstimarDto) {
    // Refresco mensual en segundo plano si los datos están viejos
    this.cifrasSync.ensureFresh();
    const meta = await this.cifrasSync.getMeta();

    const tip = this.tipologiaPara(dto.inmueble, dto.plantas);
    const precioM2 = meta?.precioM2?.[tip] ?? FALLBACK_M2[tip];
    const ratioMat = meta?.ratioMaterial?.[tip] ?? FALLBACK_RATIO[tip];

    const factorObra = FACTOR_OBRA[dto.tipoObra] ?? 1;
    const factorTerm = FACTOR_TERMINACION[dto.term] ?? 1;

    // El precio/m² de CIFRAS es Precio Final (incluye GG 25% + Beneficios 15% + IVA 21%)
    // sobre modelos tipológicos que ya contemplan baños/cocina estándar.
    // Extras por baño/cocina adicionales sobre lo típico (1 cocina, 2 baños en tipologías).
    const banosExtra = Math.max(0, dto.banos - 2);
    const cocinasExtra = Math.max(0, dto.cocinas - 1);

    const base = dto.m2 * precioM2 * factorObra * factorTerm;
    const extras = (banosExtra * 4 + cocinasExtra * 6) * (precioM2 || FALLBACK_M2.B); // ≈4 m² equiv. por baño, 6 por cocina
    const total = base + extras;

    // Descomposición del precio final en costo directo + indirectos
    const { gastosGeneralesPct, beneficiosPct, ivaPct, honorariosSugeridosPct, factorIndirectos } = CIFRAS_COMPOSICION;
    const costoDirecto = total / factorIndirectos;
    const gastosGenerales = costoDirecto * (gastosGeneralesPct / 100);
    const beneficios = (costoDirecto + gastosGenerales) * (beneficiosPct / 100);
    const iva = (costoDirecto + gastosGenerales + beneficios) * (ivaPct / 100);

    const desglose = DESGLOSE_RUBROS.map(([nombre, pct]) => ({ nombre, pct, monto: (costoDirecto * pct) / 100 }));

    return {
      total,
      material: costoDirecto * ratioMat,
      mano: costoDirecto * (1 - ratioMat),
      low: total * 0.92,
      high: total * 1.08,
      porM2: dto.m2 ? total / dto.m2 : 0,
      desglose,
      composicion: {
        costoDirecto,
        gastosGenerales,
        gastosGeneralesPct,
        beneficios,
        beneficiosPct,
        iva,
        ivaPct,
        honorariosSugeridosPct,
      },
      fuente: {
        nombre: meta?.edicion ? `Revista CIFRAS #${meta.edicion}` : 'Revista CIFRAS',
        fechaCierre: meta?.fechaCierre ?? null,
        tipologia: tip,
        aclaraciones:
          'Valores de referencia según Revista CIFRAS (Región Litoral-Centro), construcción tradicional nivel estándar. ' +
          'El precio estimado incluye costos directos (materiales + ejecución), gastos generales (25%, incl. 5% tareas profesionales de obra), beneficios (15%) e IVA (21%). ' +
          `No incluye honorarios profesionales de proyecto/dirección (sugerido ${honorariosSugeridosPct}% s/costo de obra), terreno, derechos de construcción, ni costos financieros.`,
      },
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

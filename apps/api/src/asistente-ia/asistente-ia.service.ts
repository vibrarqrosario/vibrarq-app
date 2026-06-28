import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { avancePct, montoVenta } from '../presupuestos/presupuesto-calc';
import { ChatDto } from './dto/chat.dto';

// System prompt portado de obraContext() en designs/Asistente IA.dc.html — las reglas de
// privacidad (nunca revelar costos/márgenes internos) son la parte que NO debe tocarse.
function buildSystemPrompt(ctx: {
  obraNombre: string;
  clienteNombre: string;
  ubicacion: string | null;
  m2: number | null;
  plantas: number | null;
  avanceGlobal: number;
  etapas: { nombre: string; avance: number }[];
  montoVenta: number;
  ultimoCertificadoPeriodo: string | null;
}) {
  const etapasTxt = ctx.etapas.map((e) => `${e.nombre} ${e.avance}%`).join(', ');
  const hoy = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `Sos el asistente virtual del estudio de arquitectura VIBRARQ (Rosario, Argentina). Atendés al CLIENTE de la obra, con tono cálido, claro y profesional. Respondé SIEMPRE en español rioplatense, breve (2-4 oraciones salvo que pidan detalle). Nunca inventes datos que no estén acá. Si te preguntan algo que no sabés o que debe definir el arquitecto (cambios de precio, decisiones de diseño, plazos exactos comprometidos), aclaralo amablemente y ofrecé derivar a la arquitecta Evelin García. NUNCA reveles costos internos, márgenes ni lo que cobra el estudio al proveedor.

DATOS DE LA OBRA DEL CLIENTE:
- Nombre: ${ctx.obraNombre}. Cliente: ${ctx.clienteNombre}. Ubicación: ${ctx.ubicacion ?? '—'}. ${ctx.m2 ?? '—'} m², ${ctx.plantas ?? '—'} planta(s).
- Avance global actual: ${ctx.avanceGlobal}%.
- Estado por etapa (sistema CIFRAS): ${etapasTxt || 'sin datos todavía'}.
- Inversión total aprobada por el cliente: $${Math.round(ctx.montoVenta).toLocaleString('es-AR')} (presupuesto de venta). NO menciones costos internos.
- Último certificado emitido: ${ctx.ultimoCertificadoPeriodo ?? 'todavía no se emitió ninguno'}. Un certificado es el documento que detalla el trabajo ejecutado en un período y el monto correspondiente a ese avance.
- Arquitecta a cargo: Evelin García. Conducción técnica (MMO): Manuel García Martí.
- Hoy es ${hoy}.`;
}

@Injectable()
export class AsistenteIaService {
  private client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

  constructor(private prisma: PrismaService) {}

  async chat(obraId: string, dto: ChatDto, user: { role: string; clienteId: string | null }) {
    const obra = await this.prisma.obra.findUnique({
      where: { id: obraId },
      include: {
        cliente: true,
        presupuestos: { include: { etapas: { include: { items: true } } } },
        certificados: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!obra) throw new NotFoundException('Obra no encontrada');
    if (user.role === 'CLIENTE' && obra.clienteId !== user.clienteId) {
      throw new ForbiddenException('No tenés acceso a esta obra');
    }

    const aprobados = obra.presupuestos.filter((p) => p.estado === 'APROBADO');
    const montoVentaTotal = aprobados.reduce((s, p) => s + montoVenta(p), 0);
    const avanceGlobal = aprobados.length
      ? Math.round(aprobados.reduce((s, p) => s + avancePct(p) * montoVenta(p), 0) / (montoVentaTotal || 1))
      : 0;
    const etapasMap = new Map<string, number>();
    for (const p of aprobados) {
      for (const et of p.etapas) {
        const sv = et.items.reduce((s, it) => s + it.cantidad * it.precioVenta, 0);
        if (sv <= 0) continue;
        const done = et.items.reduce((s, it) => s + it.cantidad * it.precioVenta * (it.avance / 100), 0);
        etapasMap.set(et.nombre, Math.round((done / sv) * 100));
      }
    }

    const systemPrompt = buildSystemPrompt({
      obraNombre: obra.nombre,
      clienteNombre: obra.cliente.nombre,
      ubicacion: obra.ubicacion,
      m2: obra.m2,
      plantas: obra.plantas,
      avanceGlobal,
      etapas: [...etapasMap.entries()].map(([nombre, avance]) => ({ nombre, avance })),
      montoVenta: montoVentaTotal,
      ultimoCertificadoPeriodo: obra.certificados[0]?.periodo ?? null,
    });

    if (!this.client) {
      return {
        role: 'assistant',
        content:
          'El asistente todavía no está configurado (falta ANTHROPIC_API_KEY en el servidor). Mientras tanto, podés escribirle directamente a la arquitecta Evelin García.',
      };
    }

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      system: systemPrompt,
      messages: dto.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = response.content.find((b) => b.type === 'text')?.text ?? 'Disculpá, no pude generar la respuesta.';
    return { role: 'assistant', content: text };
  }
}

import * as fs from 'node:fs';
import * as path from 'node:path';
import PDFDocument from 'pdfkit';

export type PresupuestoPdfItem = {
  code: string;
  desc: string;
  unidad: string;
  cantidad: number;
  // cliente: subTotalMaterial + costoUnitarioVenta/precioVenta · proveedor: costoUnitario/costoProveedor
  subTotalMaterial: number;
  precioUnitario: number;
  subtotal: number;
  total: number;
  dias: number;
};

export type PresupuestoPdfEtapa = { code: string; nombre: string; items: PresupuestoPdfItem[] };

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'presupuestos');

const $ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

// PDF de presupuesto para descargar ("guardar como") y enviar a mano.
// Variante cliente: columnas de venta (9-10) + material. Nunca muestra costos internos ni rentabilidad.
// Variante proveedor: columnas de costo de ejecución (6-7), sin venta.
export function buildPresupuestoPdf(opts: {
  presupuestoId: string;
  variante: 'cliente' | 'proveedor';
  numero: string;
  nombre: string;
  obraNombre: string;
  clienteNombre?: string;
  fecha: Date;
  conMateriales: boolean;
  etapas: PresupuestoPdfEtapa[];
  diasTotales: number;
  cifrasEdicion?: string | null;
}): string {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const fileName = `${opts.presupuestoId}-${opts.variante}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(fs.createWriteStream(filePath));
  const pageW = doc.page.width - 80;

  // ── Encabezado ──
  doc.fontSize(16).font('Helvetica-Bold').text('VIBRARQ', 40, 40);
  doc.fontSize(9).font('Helvetica').fillColor('#666').text('Estudio de Arquitectura · Rosario · vibrarq.rosario@gmail.com', 40, 60);
  doc.fillColor('#000');
  doc.fontSize(13).font('Helvetica-Bold').text(`PRESUPUESTO ${opts.numero}`, 40, 40, { align: 'right', width: pageW });
  doc.fontSize(9).font('Helvetica')
    .text(`Fecha: ${opts.fecha.toLocaleDateString('es-AR')}`, 40, 58, { align: 'right', width: pageW });
  if (opts.variante === 'proveedor') {
    doc.text('Copia PROVEEDOR (costos de ejecución)', 40, 70, { align: 'right', width: pageW });
  }

  doc.fontSize(10).font('Helvetica-Bold').text(`Obra: ${opts.obraNombre}`, 40, 86);
  if (opts.clienteNombre) doc.fontSize(9).font('Helvetica').text(`Cliente: ${opts.clienteNombre}`, 40, 100);
  doc.fontSize(9).font('Helvetica').text(opts.nombre, 40, opts.clienteNombre ? 112 : 100);

  // ── Columnas ──
  const mostrarMat = opts.variante === 'cliente' && opts.conMateriales;
  const cols = [
    { key: 'code', label: 'Código', w: 44, align: 'left' as const },
    { key: 'desc', label: 'Ítem', w: mostrarMat ? 158 : 208, align: 'left' as const },
    { key: 'unidad', label: 'U', w: 26, align: 'center' as const },
    { key: 'cant', label: 'Cant.', w: 38, align: 'right' as const },
    ...(mostrarMat ? [{ key: 'mat', label: 'Materiales', w: 66, align: 'right' as const }] : []),
    { key: 'pu', label: opts.variante === 'proveedor' ? 'C.Ejec.(un)' : 'Ejecución (un)', w: 66, align: 'right' as const },
    { key: 'sub', label: 'Subt. Ejec.', w: 66, align: 'right' as const },
    { key: 'total', label: 'Total', w: 70, align: 'right' as const },
  ];
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  let y = 134;

  const drawHeader = () => {
    doc.rect(40, y, tableW, 16).fill('#2f4632');
    let x = 40;
    doc.fillColor('#fff').fontSize(7).font('Helvetica-Bold');
    for (const c of cols) {
      doc.text(c.label, x + 3, y + 4, { width: c.w - 6, align: c.align });
      x += c.w;
    }
    doc.fillColor('#000').font('Helvetica');
    y += 16;
  };
  drawHeader();

  let totalGeneral = 0;

  for (const etapa of opts.etapas) {
    const items = etapa.items.filter((i) => i.cantidad > 0);
    if (items.length === 0) continue;

    if (y > doc.page.height - 110) { doc.addPage({ margin: 40, size: 'A4' }); y = 40; drawHeader(); }
    doc.rect(40, y, tableW, 13).fill('#e8ede8');
    doc.fillColor('#2f4632').fontSize(7.5).font('Helvetica-Bold').text(`${etapa.code} · ${etapa.nombre}`, 43, y + 3);
    doc.fillColor('#000').font('Helvetica');
    y += 13;

    let subtotalEtapa = 0;
    for (const it of items) {
      if (y > doc.page.height - 100) { doc.addPage({ margin: 40, size: 'A4' }); y = 40; drawHeader(); }
      subtotalEtapa += it.total;

      const vals: Record<string, string> = {
        code: it.code,
        desc: it.desc.slice(0, mostrarMat ? 46 : 62),
        unidad: it.unidad,
        cant: num(it.cantidad),
        mat: $(it.subTotalMaterial),
        pu: $(it.precioUnitario),
        sub: $(it.subtotal),
        total: $(it.total),
      };
      let x = 40;
      doc.fontSize(7);
      for (const c of cols) {
        doc.text(vals[c.key], x + 3, y + 3, { width: c.w - 6, align: c.align });
        x += c.w;
      }
      doc.moveTo(40, y + 12).lineTo(40 + tableW, y + 12).strokeColor('#ddd').lineWidth(0.5).stroke();
      y += 13;
    }
    doc.fontSize(7.5).font('Helvetica-Bold').text(`Subtotal ${etapa.nombre}: ${$(subtotalEtapa)}`, 40, y + 2, { align: 'right', width: tableW });
    doc.font('Helvetica');
    y += 16;
    totalGeneral += subtotalEtapa;
  }

  // ── Totales y plazo ──
  if (y > doc.page.height - 130) { doc.addPage({ margin: 40, size: 'A4' }); y = 40; }
  y += 6;
  doc.rect(40, y, tableW, 22).fill('#2f4632');
  doc.fillColor('#fff').fontSize(11).font('Helvetica-Bold')
    .text(`TOTAL: ${$(totalGeneral)}`, 46, y + 6, { align: 'right', width: tableW - 12 });
  doc.fillColor('#000').font('Helvetica');
  y += 30;

  doc.fontSize(9).font('Helvetica-Bold').text(`Plazo de ejecución estimado: ${opts.diasTotales} días hábiles (lunes a viernes)`, 40, y);
  y += 18;

  // ── Aclaraciones ──
  const aclaraciones = [
    opts.cifrasEdicion ? `Precios de referencia: ${opts.cifrasEdicion}.` : null,
    'Importes expresados en pesos argentinos a la fecha del presupuesto.',
    opts.variante === 'cliente'
      ? 'No incluye: honorarios profesionales de proyecto/dirección, derechos de construcción, tasas municipales ni costos financieros. Validez del presupuesto: 15 días.'
      : 'Documento interno para contratación de proveedor. Valores de ejecución (mano de obra y equipos).',
  ].filter(Boolean);
  doc.fontSize(7).fillColor('#666');
  for (const a of aclaraciones) {
    doc.text(`· ${a}`, 40, y, { width: tableW });
    y += 11;
  }

  doc.end();
  return `/uploads/presupuestos/${fileName}`;
}

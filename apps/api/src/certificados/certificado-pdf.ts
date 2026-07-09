import * as fs from 'node:fs';
import * as path from 'node:path';
import PDFDocument from 'pdfkit';

export type CertificadoPdfItem = {
  code: string;
  desc: string;
  etapa: string;
  unidad: string;
  cantidadTotal: number;
  cantidadAnterior: number;
  cantidadPresente: number;
  precioUnitario: number; // costoUnitario (proveedor) o costoUnitarioVenta (cliente)
};

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'certificados');

function ensureDir() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const $ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

// Certificado con formato Anterior / Presente / Acumulado.
// Variante proveedor usa costo de ejecución (cols 6-7 del presupuesto);
// variante cliente usa valor de ejecución de venta (cols 9-10). Nunca se mezclan.
export function buildCertificadoPdf(opts: {
  certificadoId: string;
  variante: 'proveedor' | 'cliente';
  obraNombre: string;
  clienteNombre?: string;
  numero: number;
  fecha: Date;
  periodo: string;
  items: CertificadoPdfItem[];
}): string {
  ensureDir();
  const fileName = `${opts.certificadoId}-${opts.variante}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  doc.pipe(fs.createWriteStream(filePath));
  const pageW = doc.page.width - 80;

  // ── Encabezado ──
  doc.fontSize(16).font('Helvetica-Bold').text('VIBRARQ', 40, 40);
  doc.fontSize(9).font('Helvetica').fillColor('#666').text('Estudio de Arquitectura · Rosario', 40, 60);
  doc.fillColor('#000');
  doc.fontSize(14).font('Helvetica-Bold').text(`CERTIFICADO DE OBRA N° ${opts.numero}`, 40, 40, { align: 'right', width: pageW });
  doc.fontSize(9).font('Helvetica')
    .text(`Fecha: ${opts.fecha.toLocaleDateString('es-AR')}`, 40, 60, { align: 'right', width: pageW })
    .text(`Período: ${opts.periodo}`, 40, 72, { align: 'right', width: pageW })
    .text(opts.variante === 'proveedor' ? 'Copia PROVEEDOR (costos de ejecución)' : 'Copia CLIENTE', 40, 84, { align: 'right', width: pageW });

  doc.fontSize(10).font('Helvetica-Bold').text(`Obra: ${opts.obraNombre}`, 40, 90);
  if (opts.clienteNombre) doc.fontSize(9).font('Helvetica').text(`Cliente: ${opts.clienteNombre}`, 40, 104);

  // ── Tabla ──
  const cols = [
    { key: 'code', label: 'Código', w: 50, align: 'left' as const },
    { key: 'desc', label: 'Ítem', w: 190, align: 'left' as const },
    { key: 'unidad', label: 'U', w: 28, align: 'center' as const },
    { key: 'cantTotal', label: 'Cant. contratada', w: 62, align: 'right' as const },
    { key: 'ant', label: 'Anterior', w: 55, align: 'right' as const },
    { key: 'pres', label: 'Presente', w: 55, align: 'right' as const },
    { key: 'acum', label: 'Acumulado', w: 60, align: 'right' as const },
    { key: 'avance', label: '% Acum.', w: 48, align: 'right' as const },
    { key: 'pu', label: 'P.Unit.', w: 75, align: 'right' as const },
    { key: 'monto', label: 'Importe presente', w: 90, align: 'right' as const },
  ];
  let y = 126;
  const xStart = 40;

  const drawHeader = () => {
    doc.rect(xStart, y, cols.reduce((s, c) => s + c.w, 0), 18).fill('#2f4632');
    let x = xStart;
    doc.fillColor('#fff').fontSize(7.5).font('Helvetica-Bold');
    for (const c of cols) {
      doc.text(c.label, x + 3, y + 5, { width: c.w - 6, align: c.align });
      x += c.w;
    }
    doc.fillColor('#000').font('Helvetica');
    y += 18;
  };
  drawHeader();

  let totalPresente = 0;
  let etapaActual = '';

  for (const it of opts.items) {
    if (y > doc.page.height - 90) {
      doc.addPage({ margin: 40, size: 'A4', layout: 'landscape' });
      y = 40;
      drawHeader();
    }
    if (it.etapa !== etapaActual) {
      etapaActual = it.etapa;
      doc.rect(xStart, y, cols.reduce((s, c) => s + c.w, 0), 14).fill('#e8ede8');
      doc.fillColor('#2f4632').fontSize(8).font('Helvetica-Bold').text(etapaActual, xStart + 3, y + 3);
      doc.fillColor('#000').font('Helvetica');
      y += 14;
    }

    const acumulado = it.cantidadAnterior + it.cantidadPresente;
    const avancePct = it.cantidadTotal > 0 ? Math.round((acumulado / it.cantidadTotal) * 100) : 0;
    const monto = it.precioUnitario * it.cantidadPresente;
    totalPresente += monto;

    const vals: Record<string, string> = {
      code: it.code,
      desc: it.desc.slice(0, 60),
      unidad: it.unidad,
      cantTotal: num(it.cantidadTotal),
      ant: num(it.cantidadAnterior),
      pres: num(it.cantidadPresente),
      acum: num(acumulado),
      avance: `${avancePct}%`,
      pu: $(it.precioUnitario),
      monto: $(monto),
    };
    let x = xStart;
    doc.fontSize(7.5);
    for (const c of cols) {
      doc.text(vals[c.key], x + 3, y + 3, { width: c.w - 6, align: c.align });
      x += c.w;
    }
    doc.moveTo(xStart, y + 13).lineTo(xStart + cols.reduce((s, c) => s + c.w, 0), y + 13).strokeColor('#ddd').lineWidth(0.5).stroke();
    y += 14;
  }

  // ── Total ──
  y += 8;
  const label = opts.variante === 'proveedor' ? 'TOTAL CERTIFICADO (a pagar al proveedor)' : 'TOTAL CERTIFICADO';
  doc.fontSize(11).font('Helvetica-Bold').text(`${label}: ${$(totalPresente)}`, xStart, y, { align: 'right', width: cols.reduce((s, c) => s + c.w, 0) });

  // ── Pie ──
  doc.fontSize(7).font('Helvetica').fillColor('#888')
    .text('Documento generado por VIBRARQ Studio. Importes en pesos argentinos.', 40, doc.page.height - 50, { width: pageW });

  doc.end();
  return `/uploads/certificados/${fileName}`;
}

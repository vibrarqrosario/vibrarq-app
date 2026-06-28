import * as fs from 'node:fs';
import * as path from 'node:path';
import PDFDocument from 'pdfkit';

export type CertificadoPdfItem = { code: string; desc: string; etapa: string; avance: number; monto: number };

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'certificados');

function ensureDir() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Genera un PDF de certificado — uno para "proveedor" (con costo) y otro para "cliente" (con venta).
// La diferencia entre ambos documentos es solo el monto/etiqueta que se les pasa (nunca se mezclan costo y venta en el mismo PDF).
export function buildCertificadoPdf(opts: {
  certificadoId: string;
  variante: 'proveedor' | 'cliente';
  obraNombre: string;
  periodo: string;
  items: CertificadoPdfItem[];
  total: number;
}): string {
  ensureDir();
  const fileName = `${opts.certificadoId}-${opts.variante}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(18).text('VIBRARQ Studio', { continued: false });
  doc
    .fontSize(12)
    .text(`Certificado de obra — ${opts.variante === 'proveedor' ? 'Proveedor (costo)' : 'Cliente (a pagar)'}`);
  doc.moveDown();
  doc.fontSize(11).text(`Obra: ${opts.obraNombre}`);
  doc.text(`Período: ${opts.periodo}`);
  doc.moveDown();

  doc.fontSize(10);
  for (const it of opts.items) {
    doc.text(`${it.code}  ${it.desc}  (${it.etapa})  ·  ${it.avance}%  ·  $${Math.round(it.monto).toLocaleString('es-AR')}`);
  }

  doc.moveDown();
  doc.fontSize(13).text(`Total: $${Math.round(opts.total).toLocaleString('es-AR')}`, { align: 'right' });

  doc.end();
  return `/uploads/certificados/${fileName}`;
}

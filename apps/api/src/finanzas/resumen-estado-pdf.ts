import * as fs from 'node:fs';
import * as path from 'node:path';
import PDFDocument from 'pdfkit';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'informes');
const $ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

export type ResumenEstadoData = {
  kpis: { obrasActivas: number; saldoCaja: number; porCobrar: number; porPagar: number; alertas: number };
  obras: { nombre: string; cliente: string; avance: number; esperado: number | null; venta: number; margenPct: number }[];
  alertas: { obra: string; tipo: string; detalle: string }[];
  presupuestos: { anio: number; enviados: number; aceptados: number; porMes: { mes: string; enviados: number; aceptados: number }[] };
  cobradoAnio: number;
  gastadoAnio: number;
};

// Informe ejecutivo del estudio: obras en marcha, caja, alertas y presupuestos del año.
export function buildResumenEstadoPdf(data: ResumenEstadoData): string {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const hoy = new Date();
  const fileName = `resumen-estado-${hoy.toISOString().slice(0, 10)}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  const doc = new PDFDocument({ margin: 46, size: 'A4' });
  doc.pipe(fs.createWriteStream(filePath));
  const W = doc.page.width - 92;

  // ── Encabezado ──
  doc.fontSize(17).font('Helvetica-Bold').text('VIBRARQ', 46, 46);
  doc.fontSize(9).font('Helvetica').fillColor('#666').text('Estudio de Arquitectura · Rosario', 46, 66);
  doc.fillColor('#000').fontSize(14).font('Helvetica-Bold').text('RESUMEN DE ESTADO', 46, 46, { align: 'right', width: W });
  doc.fontSize(9).font('Helvetica').text(`Generado: ${hoy.toLocaleDateString('es-AR')} ${hoy.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`, 46, 64, { align: 'right', width: W });

  let y = 96;

  // ── KPIs ──
  const kpis = [
    ['Obras activas', String(data.kpis.obrasActivas)],
    ['Dinero en caja', $(data.kpis.saldoCaja)],
    ['Por cobrar', $(data.kpis.porCobrar)],
    ['Por pagar', $(data.kpis.porPagar)],
    ['Alertas', String(data.kpis.alertas)],
  ];
  const boxW = (W - 4 * 8) / 5;
  kpis.forEach(([label, value], i) => {
    const x = 46 + i * (boxW + 8);
    doc.roundedRect(x, y, boxW, 46, 5).fillAndStroke('#f4f6f3', '#d8ded6');
    doc.fillColor('#667').fontSize(6.5).font('Helvetica-Bold').text(label.toUpperCase(), x + 6, y + 8, { width: boxW - 12 });
    doc.fillColor('#1c2b20').fontSize(12).font('Helvetica-Bold').text(value, x + 6, y + 22, { width: boxW - 12 });
  });
  doc.fillColor('#000').font('Helvetica');
  y += 66;

  const section = (titulo: string) => {
    if (y > doc.page.height - 120) { doc.addPage(); y = 46; }
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2f4632').text(titulo, 46, y);
    doc.fillColor('#000').font('Helvetica');
    y += 18;
  };

  // ── Obras en marcha ──
  section('Obras en marcha');
  const cols = [
    { label: 'Obra', w: 150, align: 'left' as const },
    { label: 'Cliente', w: 100, align: 'left' as const },
    { label: 'Monto contratado', w: 90, align: 'right' as const },
    { label: 'Avance', w: 50, align: 'right' as const },
    { label: 'Esperado', w: 55, align: 'right' as const },
    { label: 'Margen', w: 50, align: 'right' as const },
  ];
  let x = 46;
  doc.rect(46, y, cols.reduce((s, c) => s + c.w, 0), 15).fill('#2f4632');
  doc.fillColor('#fff').fontSize(7.5).font('Helvetica-Bold');
  for (const c of cols) { doc.text(c.label, x + 4, y + 4, { width: c.w - 8, align: c.align }); x += c.w; }
  doc.fillColor('#000').font('Helvetica');
  y += 15;

  for (const o of data.obras) {
    if (y > doc.page.height - 80) { doc.addPage(); y = 46; }
    const vals = [o.nombre.slice(0, 34), o.cliente.slice(0, 22), $(o.venta), `${o.avance}%`, o.esperado != null ? `${o.esperado}%` : '—', `${o.margenPct}%`];
    x = 46;
    doc.fontSize(8);
    vals.forEach((v, i) => { doc.text(v, x + 4, y + 3, { width: cols[i].w - 8, align: cols[i].align }); x += cols[i].w; });
    // barra de avance debajo del texto de la fila
    doc.moveTo(46, y + 14).lineTo(46 + cols.reduce((s, c) => s + c.w, 0), y + 14).strokeColor('#e2e6e0').lineWidth(0.5).stroke();
    y += 16;
  }
  if (data.obras.length === 0) { doc.fontSize(8.5).fillColor('#888').text('Sin obras con presupuesto contratado.', 46, y); doc.fillColor('#000'); y += 14; }
  y += 10;

  // ── Alertas ──
  section(`Alertas (${data.alertas.length})`);
  if (data.alertas.length === 0) {
    doc.fontSize(8.5).fillColor('#3c7a46').text('Sin alertas. Todo en orden.', 46, y);
    doc.fillColor('#000');
    y += 16;
  }
  for (const a of data.alertas) {
    if (y > doc.page.height - 70) { doc.addPage(); y = 46; }
    const color = a.tipo === 'RETRASO' ? '#b05a2a' : a.tipo === 'MARGEN' ? '#a33d3d' : '#8a6d1f';
    doc.circle(50, y + 5, 2.5).fill(color);
    doc.fillColor(color).fontSize(8).font('Helvetica-Bold').text(a.tipo, 58, y, { continued: true });
    doc.fillColor('#333').font('Helvetica').text(`  ${a.obra} — ${a.detalle}`);
    doc.fillColor('#000');
    y += 15;
  }
  y += 10;

  // ── Presupuestos del año ──
  section(`Presupuestos ${data.presupuestos.anio}`);
  const tasa = data.presupuestos.enviados > 0 ? Math.round((data.presupuestos.aceptados / data.presupuestos.enviados) * 100) : 0;
  doc.fontSize(9).text(`Enviados: ${data.presupuestos.enviados} · Aceptados: ${data.presupuestos.aceptados} · Tasa de aceptación: ${tasa}%`, 46, y);
  y += 16;
  // mini gráfico de barras por mes
  const maxV = Math.max(1, ...data.presupuestos.porMes.map((m) => m.enviados));
  const bw = 22; const bh = 50; const gap = 14;
  for (let i = 0; i < data.presupuestos.porMes.length; i++) {
    const m = data.presupuestos.porMes[i];
    const bx = 46 + i * (bw * 2 + gap);
    if (bx + bw * 2 > 46 + W) break;
    const hEnv = (m.enviados / maxV) * bh;
    const hAce = (m.aceptados / maxV) * bh;
    doc.rect(bx, y + bh - hEnv, bw - 2, hEnv).fill('#9db6a0');
    doc.rect(bx + bw, y + bh - hAce, bw - 2, hAce).fill('#2f4632');
    doc.fillColor('#666').fontSize(6.5).text(m.mes, bx, y + bh + 3, { width: bw * 2 - 2, align: 'center' });
    doc.fillColor('#000');
  }
  y += bh + 16;
  doc.fontSize(7).fillColor('#666').text('Barra clara: enviados · Barra oscura: aceptados', 46, y);
  doc.fillColor('#000');
  y += 20;

  // ── Flujo del año ──
  section(`Flujo de dinero ${data.presupuestos.anio}`);
  doc.fontSize(9)
    .text(`Cobrado en el año: ${$(data.cobradoAnio)}`, 46, y)
    .text(`Gastos del año: ${$(data.gastadoAnio)}`, 46, y + 14)
    .font('Helvetica-Bold')
    .text(`Resultado: ${$(data.cobradoAnio - data.gastadoAnio)}`, 46, y + 28)
    .font('Helvetica');
  y += 50;

  doc.fontSize(7).fillColor('#888').text('Informe generado automáticamente por VIBRARQ Studio. Importes en pesos argentinos.', 46, doc.page.height - 60, { width: W });

  doc.end();
  return `/uploads/informes/${fileName}`;
}

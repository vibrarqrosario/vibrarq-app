import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as path from 'node:path';
import { Roles } from '../auth/roles.decorator';
import { CreateCuentaCobrarDto } from './dto/create-cuenta-cobrar.dto';
import { CreateCuentaPagarDto } from './dto/create-cuenta-pagar.dto';
import { UpdateEstadoPagoDto } from './dto/update-estado-pago.dto';
import { FinanzasService } from './finanzas.service';
import { buildResumenEstadoPdf } from './resumen-estado-pdf';

@Roles('SOCIO')
@Controller('finanzas')
export class FinanzasController {
  constructor(private finanzasService: FinanzasService) {}

  @Get('resumen')
  resumen() {
    return this.finanzasService.resumen();
  }

  // ── Analítica (dashboard Inicio) ──
  @Get('analitica')
  analitica() {
    return this.finanzasService.analitica();
  }

  // Informe ejecutivo en PDF: obras en marcha, caja, alertas, presupuestos del año
  @Get('resumen-estado/pdf')
  async resumenEstadoPdf(@Res() res: Response) {
    const data = await this.finanzasService.analitica();
    const url = buildResumenEstadoPdf(data);
    const fileName = path.basename(url);
    res.download(path.join(process.cwd(), 'uploads', 'informes', fileName), fileName);
  }

  // ── Gastos ──
  @Get('gastos')
  findGastos() {
    return this.finanzasService.findGastos();
  }

  // multipart/form-data: campos concepto, monto, obraId?, fecha? + archivo "factura" (imagen o pdf)
  @Post('gastos')
  @UseInterceptors(FileInterceptor('factura'))
  createGasto(
    @Body() body: { concepto: string; monto: string; obraId?: string; fecha?: string },
    @UploadedFile() factura?: { buffer: Buffer; mimetype: string },
  ) {
    return this.finanzasService.createGasto(
      { concepto: body.concepto, monto: parseFloat(body.monto), obraId: body.obraId || undefined, fecha: body.fecha || undefined },
      factura,
    );
  }

  @Delete('gastos/:id')
  deleteGasto(@Param('id') id: string) {
    return this.finanzasService.deleteGasto(id);
  }

  @Get('gastos/:id/factura')
  async getFactura(@Param('id') id: string, @Res() res: Response) {
    const { data, mime } = await this.finanzasService.getFactura(id);
    res.setHeader('Content-Type', mime);
    res.send(data);
  }

  // ── Pagos recibidos (para movimientos) ──
  @Get('pagos')
  findPagos() {
    return this.finanzasService.findPagos();
  }

  @Get('cuentas-cobrar')
  findCuentasCobrar() {
    return this.finanzasService.findCuentasCobrar();
  }

  @Get('cuentas-pagar')
  findCuentasPagar() {
    return this.finanzasService.findCuentasPagar();
  }

  @Post('cuentas-cobrar')
  createCuentaCobrar(@Body() dto: CreateCuentaCobrarDto) {
    return this.finanzasService.createCuentaCobrar(dto);
  }

  @Post('cuentas-pagar')
  createCuentaPagar(@Body() dto: CreateCuentaPagarDto) {
    return this.finanzasService.createCuentaPagar(dto);
  }

  @Patch('cuentas-cobrar/:id')
  updateEstadoCobrar(@Param('id') id: string, @Body() dto: UpdateEstadoPagoDto) {
    return this.finanzasService.updateEstadoCobrar(id, dto);
  }

  @Patch('cuentas-pagar/:id')
  updateEstadoPagar(@Param('id') id: string, @Body() dto: UpdateEstadoPagoDto) {
    return this.finanzasService.updateEstadoPagar(id, dto);
  }
}

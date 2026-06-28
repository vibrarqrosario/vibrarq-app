import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/roles.decorator';
import { CertificadosService } from './certificados.service';
import { CreateCertificadoDto } from './dto/create-certificado.dto';

@Controller('obras/:obraId/certificados')
export class CertificadosController {
  constructor(
    private certificadosService: CertificadosService,
    private prisma: PrismaService,
  ) {}

  private async assertOwnership(obraId: string, user: { role: string; clienteId: string | null }) {
    if (user.role !== 'CLIENTE') return;
    const obra = await this.prisma.obra.findUnique({ where: { id: obraId } });
    if (!obra || obra.clienteId !== user.clienteId) throw new ForbiddenException('No tenés acceso a esta obra');
  }

  @Roles('SOCIO', 'CLIENTE')
  @Get()
  async findAll(@Param('obraId') obraId: string, @Req() req: any) {
    await this.assertOwnership(obraId, req.user);
    const certs = await this.certificadosService.findAllForObra(obraId);
    if (req.user.role === 'CLIENTE') {
      // El cliente solo ve el monto que le toca pagar (venta) y su propio PDF.
      return certs.map(({ totalCosto, pdfProveedorUrl, ...rest }) => rest);
    }
    return certs;
  }

  @Roles('SOCIO')
  @Post()
  create(@Param('obraId') obraId: string, @Body() dto: CreateCertificadoDto) {
    return this.certificadosService.create(obraId, dto);
  }

  // El cliente solo puede descargar la variante "cliente" (sin costos internos).
  @Roles('SOCIO', 'CLIENTE')
  @Get(':certId/pdf')
  async downloadPdf(
    @Param('obraId') obraId: string,
    @Param('certId') certId: string,
    @Query('variant') variant: 'proveedor' | 'cliente' = 'cliente',
    @Req() req: any,
    @Res() res: Response,
  ) {
    await this.assertOwnership(obraId, req.user);
    const effectiveVariant = req.user.role === 'CLIENTE' ? 'cliente' : variant;
    const cert = await this.prisma.certificado.findUnique({ where: { id: certId } });
    if (!cert || cert.obraId !== obraId) throw new NotFoundException('Certificado no encontrado');
    const url = effectiveVariant === 'proveedor' ? cert.pdfProveedorUrl : cert.pdfClienteUrl;
    if (!url) throw new NotFoundException('PDF no generado');
    res.sendFile(path.basename(url), { root: path.join(process.cwd(), 'uploads', 'certificados') });
  }
}

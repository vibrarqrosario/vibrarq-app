import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CreateAdicionalDto } from './dto/create-adicional.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { sanitizeForCliente } from './presupuesto-calc';
import { PresupuestosService } from './presupuestos.service';

@Controller()
export class PresupuestosController {
  constructor(private presupuestosService: PresupuestosService) {}

  @Roles('SOCIO', 'CLIENTE')
  @Get('presupuestos/:id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    await this.presupuestosService.assertOwnership(id, req.user);
    const presupuesto = await this.presupuestosService.findOne(id);
    if (req.user.role === 'CLIENTE') {
      return { ...presupuesto, etapas: sanitizeForCliente(presupuesto.etapas) };
    }
    return presupuesto;
  }

  @Roles('SOCIO')
  @Patch('items/:itemId')
  updateItem(@Param('itemId') itemId: string, @Body() dto: UpdateItemDto) {
    return this.presupuestosService.updateItem(itemId, dto);
  }

  @Roles('SOCIO')
  @Post('etapas/:etapaId/items')
  addItem(@Param('etapaId') etapaId: string) {
    return this.presupuestosService.addItem(etapaId);
  }

  @Roles('SOCIO')
  @Delete('items/:itemId')
  removeItem(@Param('itemId') itemId: string) {
    return this.presupuestosService.removeItem(itemId);
  }

  @Roles('SOCIO')
  @Post('presupuestos/:presupuestoId/etapas')
  addEtapa(@Param('presupuestoId') presupuestoId: string) {
    return this.presupuestosService.addEtapa(presupuestoId);
  }

  @Roles('SOCIO')
  @Post('presupuestos/:presupuestoId/aplicar-fuente')
  aplicarFuente(@Param('presupuestoId') presupuestoId: string, @Body('fuente') fuente: 'CIFRAS' | 'VIBRARQ') {
    return this.presupuestosService.aplicarFuente(presupuestoId, fuente);
  }

  @Roles('SOCIO')
  @Post('presupuestos/:presupuestoId/confirmar')
  confirmar(@Param('presupuestoId') presupuestoId: string) {
    return this.presupuestosService.confirmarPresupuesto(presupuestoId);
  }

  @Roles('SOCIO')
  @Patch('catalogo/:codigo/costo-vibrarq')
  updateCostoVibrarq(@Param('codigo') codigo: string, @Body('costo') costo: number) {
    return this.presupuestosService.updateCostoVibrarq(codigo, costo);
  }

  @Roles('SOCIO')
  @Post('obras/:obraId/presupuestos')
  createAdicional(@Param('obraId') obraId: string, @Body() dto: CreateAdicionalDto) {
    return this.presupuestosService.createAdicional(obraId, dto);
  }
}

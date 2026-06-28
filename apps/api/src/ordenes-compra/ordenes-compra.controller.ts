import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CreateOrdenCompraDto } from './dto/create-orden-compra.dto';
import { OrdenesCompraService } from './ordenes-compra.service';

@Roles('SOCIO')
@Controller()
export class OrdenesCompraController {
  constructor(private ordenesCompraService: OrdenesCompraService) {}

  @Get('proveedores')
  findAllProveedores() {
    return this.ordenesCompraService.findAllProveedores();
  }

  @Get('ordenes-compra')
  findRecientes(@Query('presupuestoId') presupuestoId?: string) {
    if (presupuestoId) return this.ordenesCompraService.findForPresupuesto(presupuestoId);
    return this.ordenesCompraService.findRecientes();
  }

  @Post('ordenes-compra')
  create(@Body() dto: CreateOrdenCompraDto, @Req() req: any) {
    return this.ordenesCompraService.create(dto, req.user.userId);
  }

  @Patch('ordenes-compra/:id/recibida')
  marcarRecibida(@Param('id') id: string) {
    return this.ordenesCompraService.marcarRecibida(id);
  }
}

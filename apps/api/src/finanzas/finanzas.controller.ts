import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CreateCuentaCobrarDto } from './dto/create-cuenta-cobrar.dto';
import { CreateCuentaPagarDto } from './dto/create-cuenta-pagar.dto';
import { UpdateEstadoPagoDto } from './dto/update-estado-pago.dto';
import { FinanzasService } from './finanzas.service';

@Roles('SOCIO')
@Controller('finanzas')
export class FinanzasController {
  constructor(private finanzasService: FinanzasService) {}

  @Get('resumen')
  resumen() {
    return this.finanzasService.resumen();
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

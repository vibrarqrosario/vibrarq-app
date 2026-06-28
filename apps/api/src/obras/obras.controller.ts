import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CreateObraDto } from './dto/create-obra.dto';
import { ObrasService } from './obras.service';

@Controller('obras')
export class ObrasController {
  constructor(private obrasService: ObrasService) {}

  @Roles('SOCIO')
  @Get()
  findAllGroupedByCliente() {
    return this.obrasService.findAllGroupedByCliente();
  }

  @Roles('CLIENTE')
  @Get('mias')
  findMine(@Req() req: any) {
    return this.obrasService.findMine(req.user.clienteId);
  }

  @Roles('SOCIO', 'CLIENTE')
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.obrasService.findOne(id, req.user);
  }

  @Roles('SOCIO', 'CLIENTE')
  @Get(':id/consolidado')
  getConsolidado(@Param('id') id: string, @Req() req: any) {
    return this.obrasService.getConsolidado(id, req.user);
  }

  @Roles('SOCIO')
  @Post()
  create(@Body() dto: CreateObraDto) {
    return this.obrasService.create(dto);
  }
}

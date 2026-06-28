import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { AgendaService } from './agenda.service';
import { CreateAvisoDto } from './dto/create-aviso.dto';
import { CreateComentarioDto } from './dto/create-comentario.dto';
import { CreateEventoDto } from './dto/create-evento.dto';
import { CreateFeedPostDto } from './dto/create-feed-post.dto';

@Roles('SOCIO', 'COMMUNITY_MANAGER')
@Controller('agenda')
export class AgendaController {
  constructor(private agendaService: AgendaService) {}

  @Get('feed')
  findFeed(@Query('obraId') obraId?: string) {
    return this.agendaService.findFeed(obraId);
  }

  @Post('feed')
  createFeedPost(@Body() dto: CreateFeedPostDto, @Req() req: any) {
    return this.agendaService.createFeedPost(dto, req.user.userId);
  }

  @Post('feed/:id/like')
  toggleLike(@Param('id') id: string, @Req() req: any) {
    return this.agendaService.toggleLike(id, req.user.userId);
  }

  @Post('feed/:id/comentarios')
  addComentario(@Param('id') id: string, @Body() dto: CreateComentarioDto, @Req() req: any) {
    return this.agendaService.addComentario(id, dto, req.user.userId);
  }

  @Get('eventos')
  findEventosSemana() {
    return this.agendaService.findEventosSemana();
  }

  @Post('eventos')
  createEvento(@Body() dto: CreateEventoDto) {
    return this.agendaService.createEvento(dto);
  }

  @Get('avisos')
  findAvisos() {
    return this.agendaService.findAvisos();
  }

  @Post('avisos')
  createAviso(@Body() dto: CreateAvisoDto, @Req() req: any) {
    return this.agendaService.createAviso(dto, req.user.userId);
  }
}

import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { AsistenteIaService } from './asistente-ia.service';
import { ChatDto } from './dto/chat.dto';

@Roles('SOCIO', 'CLIENTE')
@Controller('obras/:obraId/asistente')
export class AsistenteIaController {
  constructor(private service: AsistenteIaService) {}

  @Post('chat')
  chat(@Param('obraId') obraId: string, @Body() dto: ChatDto, @Req() req: any) {
    return this.service.chat(obraId, dto, req.user);
  }
}

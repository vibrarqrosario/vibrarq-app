import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/roles.decorator';
import { CreateAmbienteDto } from './dto/create-ambiente.dto';
import { CreateArchivoDto } from './dto/create-archivo.dto';
import { CreateMoodboardItemDto } from './dto/create-moodboard-item.dto';
import { UpdateAmbienteDto } from './dto/update-ambiente.dto';
import { ObraExtrasService } from './obra-extras.service';

@Roles('SOCIO', 'CLIENTE')
@Controller('obras/:obraId')
export class ObraExtrasController {
  constructor(
    private service: ObraExtrasService,
    private prisma: PrismaService,
  ) {}

  private async assertOwnership(obraId: string, user: { role: string; clienteId: string | null }) {
    if (user.role !== 'CLIENTE') return;
    const obra = await this.prisma.obra.findUnique({ where: { id: obraId } });
    if (!obra || obra.clienteId !== user.clienteId) throw new ForbiddenException('No tenés acceso a esta obra');
  }

  @Get('ambientes')
  async findAmbientes(@Param('obraId') obraId: string, @Req() req: any) {
    await this.assertOwnership(obraId, req.user);
    return this.service.findAmbientes(obraId);
  }

  @Roles('SOCIO')
  @Post('ambientes')
  createAmbiente(@Param('obraId') obraId: string, @Body() dto: CreateAmbienteDto) {
    return this.service.createAmbiente(obraId, dto);
  }

  @Roles('SOCIO')
  @Patch('ambientes/:id')
  updateAmbiente(@Param('id') id: string, @Body() dto: UpdateAmbienteDto) {
    return this.service.updateAmbiente(id, dto);
  }

  @Get('moodboard')
  async findMoodboard(@Param('obraId') obraId: string, @Req() req: any) {
    await this.assertOwnership(obraId, req.user);
    return this.service.findMoodboard(obraId);
  }

  @Roles('SOCIO')
  @Post('moodboard')
  createMoodboardItem(@Param('obraId') obraId: string, @Body() dto: CreateMoodboardItemDto) {
    return this.service.createMoodboardItem(obraId, dto);
  }

  @Get('planos')
  async findPlanos(@Param('obraId') obraId: string, @Req() req: any) {
    await this.assertOwnership(obraId, req.user);
    return this.service.findPlanos(obraId);
  }

  @Roles('SOCIO')
  @Post('planos/carpetas')
  createCarpeta(@Param('obraId') obraId: string, @Body('nombre') nombre: string) {
    return this.service.createCarpeta(obraId, nombre);
  }

  @Roles('SOCIO')
  @Post('planos/carpetas/:carpetaId/archivos')
  addArchivo(@Param('carpetaId') carpetaId: string, @Body() dto: CreateArchivoDto) {
    return this.service.addArchivo(carpetaId, dto);
  }

  // El folderId se toma de la URL de Drive: drive.google.com/drive/folders/<este-id>
  @Roles('SOCIO')
  @Patch('drive-folder')
  linkDriveFolder(@Param('obraId') obraId: string, @Body('driveFolderId') driveFolderId: string) {
    return this.service.linkDriveFolder(obraId, driveFolderId);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleOauthService } from '../configuracion/google-oauth.service';
import { CreateAmbienteDto } from './dto/create-ambiente.dto';
import { CreateArchivoDto } from './dto/create-archivo.dto';
import { CreateMoodboardItemDto } from './dto/create-moodboard-item.dto';
import { UpdateAmbienteDto } from './dto/update-ambiente.dto';

@Injectable()
export class ObraExtrasService {
  constructor(
    private prisma: PrismaService,
    private googleOauthService: GoogleOauthService,
  ) {}

  // ── Ambientes (antes/después) ──
  findAmbientes(obraId: string) {
    return this.prisma.ambiente.findMany({ where: { obraId } });
  }

  createAmbiente(obraId: string, dto: CreateAmbienteDto) {
    return this.prisma.ambiente.create({ data: { ...dto, obraId } });
  }

  async updateAmbiente(id: string, dto: UpdateAmbienteDto) {
    const ambiente = await this.prisma.ambiente.findUnique({ where: { id } });
    if (!ambiente) throw new NotFoundException('Ambiente no encontrado');
    return this.prisma.ambiente.update({ where: { id }, data: dto });
  }

  // ── Moodboard ──
  findMoodboard(obraId: string) {
    return this.prisma.moodboardItem.findMany({ where: { obraId } });
  }

  createMoodboardItem(obraId: string, dto: CreateMoodboardItemDto) {
    return this.prisma.moodboardItem.create({ data: { ...dto, obraId } });
  }

  async removeMoodboardItem(id: string) {
    await this.prisma.moodboardItem.delete({ where: { id } });
    return { ok: true };
  }

  // ── Planos (Drive) ──
  // Si la obra tiene una carpeta de Drive vinculada y la integración está conectada,
  // lista los archivos reales. Si no, cae al set local (CarpetaDrive/ArchivoDrive, mock).
  async findPlanos(obraId: string) {
    const obra = await this.prisma.obra.findUnique({ where: { id: obraId } });
    if (!obra) throw new NotFoundException('Obra no encontrada');

    if (obra.driveFolderId) {
      const client = await this.googleOauthService.getAuthorizedClient();
      if (client) {
        try {
          return await this.listDriveFolder(client, obra.driveFolderId);
        } catch {
          // Carpeta inaccesible/inexistente o token inválido: cae al set local en vez de romper la pantalla.
        }
      }
    }

    const carpetas = await this.prisma.carpetaDrive.findMany({ where: { obraId }, include: { archivos: { orderBy: { createdAt: 'desc' } } } });
    return carpetas.map((c) => ({ ...c, fuente: 'mock' as const }));
  }

  private async listDriveFolder(authClient: InstanceType<typeof google.auth.OAuth2>, folderId: string) {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, modifiedTime, webViewLink, size)',
      orderBy: 'modifiedTime desc',
    });
    const archivos = (res.data.files ?? []).map((f) => ({
      id: f.id,
      nombre: f.name,
      extension: f.name?.split('.').pop() ?? '',
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
      pesoBytes: f.size ? Number(f.size) : null,
    }));
    return [{ id: folderId, nombre: 'Google Drive', fuente: 'drive' as const, archivos }];
  }

  async linkDriveFolder(obraId: string, driveFolderId: string) {
    const obra = await this.prisma.obra.findUnique({ where: { id: obraId } });
    if (!obra) throw new NotFoundException('Obra no encontrada');
    // Acepta tanto el ID puro como la URL completa de Drive.
    const match = driveFolderId.match(/folders\/([a-zA-Z0-9_-]+)/);
    const id = match ? match[1] : driveFolderId.trim();
    return this.prisma.obra.update({ where: { id: obraId }, data: { driveFolderId: id } });
  }

  async createCarpeta(obraId: string, nombre: string) {
    return this.prisma.carpetaDrive.create({ data: { obraId, nombre } });
  }

  async addArchivo(carpetaId: string, dto: CreateArchivoDto) {
    const carpeta = await this.prisma.carpetaDrive.findUnique({ where: { id: carpetaId } });
    if (!carpeta) throw new NotFoundException('Carpeta no encontrada');
    const ultimaVersion = await this.prisma.archivoDrive.count({ where: { carpetaId, nombre: dto.nombre } });
    return this.prisma.archivoDrive.create({
      data: { carpetaId, nombre: dto.nombre, extension: dto.extension, autor: dto.autor, version: ultimaVersion + 1 },
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAvisoDto } from './dto/create-aviso.dto';
import { CreateComentarioDto } from './dto/create-comentario.dto';
import { CreateEventoDto } from './dto/create-evento.dto';
import { CreateFeedPostDto } from './dto/create-feed-post.dto';

const FEED_INCLUDE = {
  autor: true,
  obra: true,
  likes: true,
  comentarios: { include: { autor: true }, orderBy: { createdAt: 'asc' as const } },
} as const;

@Injectable()
export class AgendaService {
  constructor(private prisma: PrismaService) {}

  findFeed(obraId?: string) {
    return this.prisma.feedPost.findMany({
      where: obraId ? { obraId } : undefined,
      include: FEED_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  createFeedPost(dto: CreateFeedPostDto, autorId: string) {
    return this.prisma.feedPost.create({ data: { ...dto, autorId }, include: FEED_INCLUDE });
  }

  async toggleLike(feedPostId: string, usuarioId: string) {
    const existing = await this.prisma.like.findUnique({ where: { feedPostId_usuarioId: { feedPostId, usuarioId } } });
    if (existing) {
      await this.prisma.like.delete({ where: { id: existing.id } });
      return { liked: false };
    }
    await this.prisma.like.create({ data: { feedPostId, usuarioId } });
    return { liked: true };
  }

  async addComentario(feedPostId: string, dto: CreateComentarioDto, autorId: string) {
    const feedPost = await this.prisma.feedPost.findUnique({ where: { id: feedPostId } });
    if (!feedPost) throw new NotFoundException('Publicación no encontrada');
    return this.prisma.comentario.create({ data: { feedPostId, texto: dto.texto, autorId }, include: { autor: true } });
  }

  findEventosSemana() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return this.prisma.evento.findMany({
      where: { fecha: { gte: start, lt: end } },
      include: { asignados: true, obra: true },
      orderBy: { fecha: 'asc' },
    });
  }

  createEvento(dto: CreateEventoDto) {
    return this.prisma.evento.create({
      data: {
        tipo: dto.tipo,
        fecha: new Date(dto.fecha),
        obraId: dto.obraId,
        asignados: dto.asignadoIds ? { connect: dto.asignadoIds.map((id) => ({ id })) } : undefined,
      },
      include: { asignados: true, obra: true },
    });
  }

  findAvisos() {
    return this.prisma.aviso.findMany({ include: { autor: true }, orderBy: { createdAt: 'desc' }, take: 20 });
  }

  createAviso(dto: CreateAvisoDto, autorId: string) {
    return this.prisma.aviso.create({ data: { texto: dto.texto, autorId }, include: { autor: true } });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

const ESTADOS = ['IDEA', 'DISENO', 'APROBACION', 'PROGRAMADO', 'PUBLICADO'];

@Injectable()
export class PlannerService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.post.findMany({ include: { asignado: true, obra: true }, orderBy: { fecha: 'asc' } });
  }

  async resumen() {
    const posts = await this.prisma.post.findMany({ include: { asignado: true } });
    const now = new Date();
    const hoy = posts.filter((p) => p.fecha.toDateString() === now.toDateString());
    const atrasadas = posts.filter((p) => p.fecha < now && p.estado !== 'PUBLICADO');
    const proximas = posts.filter((p) => p.fecha > now && p.estado !== 'PUBLICADO');

    const cargaPorPersona = new Map<string, number>();
    for (const p of posts) {
      if (p.estado === 'PUBLICADO' || !p.asignado) continue;
      cargaPorPersona.set(p.asignado.nombre, (cargaPorPersona.get(p.asignado.nombre) ?? 0) + 1);
    }

    return {
      total: posts.length,
      hoy: hoy.length,
      atrasadas: atrasadas.length,
      proximas: proximas.length,
      cargaPorPersona: [...cargaPorPersona.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad })),
    };
  }

  kanban() {
    return this.prisma.post.findMany({ include: { asignado: true }, orderBy: { fecha: 'asc' } }).then((posts) => {
      return ESTADOS.map((estado) => ({ estado, posts: posts.filter((p) => p.estado === estado) }));
    });
  }

  create(dto: CreatePostDto) {
    return this.prisma.post.create({ data: { ...dto, fecha: new Date(dto.fecha), estado: dto.estado ?? 'IDEA' } });
  }

  async update(id: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post no encontrado');
    return this.prisma.post.update({
      where: { id },
      data: { ...dto, fecha: dto.fecha ? new Date(dto.fecha) : undefined },
    });
  }

  async remove(id: string) {
    await this.prisma.post.delete({ where: { id } });
    return { ok: true };
  }
}

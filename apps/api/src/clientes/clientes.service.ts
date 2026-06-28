import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.cliente.findMany({ include: { obras: true } });
  }

  findOne(id: string) {
    return this.prisma.cliente.findUnique({ where: { id }, include: { obras: true } });
  }

  create(dto: CreateClienteDto) {
    return this.prisma.cliente.create({ data: dto });
  }
}

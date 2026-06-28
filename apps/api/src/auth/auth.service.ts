import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    // omit: false desactiva acá el omit global de passwordHash (necesario para bcrypt.compare).
    const user = await this.prisma.usuario.findUnique({ where: { email }, omit: { passwordHash: false } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const payload = { sub: user.id, email: user.email, role: user.role, clienteId: user.clienteId };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, email: user.email, nombre: user.nombre, role: user.role, clienteId: user.clienteId },
    };
  }
}

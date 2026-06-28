import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { ClientesModule } from './clientes/clientes.module';
import { ObrasModule } from './obras/obras.module';
import { PresupuestosModule } from './presupuestos/presupuestos.module';
import { CertificadosModule } from './certificados/certificados.module';
import { FinanzasModule } from './finanzas/finanzas.module';
import { OrdenesCompraModule } from './ordenes-compra/ordenes-compra.module';
import { CotizacionPublicaModule } from './cotizacion-publica/cotizacion-publica.module';
import { AsistenteIaModule } from './asistente-ia/asistente-ia.module';
import { PlannerModule } from './planner/planner.module';
import { AgendaModule } from './agenda/agenda.module';
import { ConfiguracionModule } from './configuracion/configuracion.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ClientesModule,
    ObrasModule,
    PresupuestosModule,
    CertificadosModule,
    FinanzasModule,
    OrdenesCompraModule,
    CotizacionPublicaModule,
    AsistenteIaModule,
    PlannerModule,
    AgendaModule,
    ConfiguracionModule,
    UsuariosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

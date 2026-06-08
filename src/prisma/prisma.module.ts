// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Hace que el servicio esté disponible en toda la app sin reimportar el módulo
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Permite que otros módulos lo usen
})
export class PrismaModule {}

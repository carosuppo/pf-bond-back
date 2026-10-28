import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserModule } from '../user/user.module';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { DocumentStorageService } from './storage/document-storage.service';
import { DocumentPrismaRepository } from './repository/document.prisma.repository';

@Module({
  imports: [UserModule],
  controllers: [DocumentController],
  providers: [
    PrismaService,
    DocumentService,
    DocumentStorageService,
    { provide: 'documentRepository', useClass: DocumentPrismaRepository },
  ],
})
export class DocumentModule {}

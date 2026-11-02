import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DocumentInputDto } from './dto/document-input.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import { FolderInputDto } from './dto/folder-input.dto';
import { DocumentFile } from './interface/document-file.interface';
import { validateDocumentFile } from './validator/document-file.validator';
import {
  documentResponse,
  folderResponse,
  documentListingResponse,
  documentStatusResponse,
} from './mapper/document.mapper';
import type { IDocumentRepository } from './repository/document.repository.interface';
import type { DocumentPublication } from './interface/document-publication.interface';
import { DocumentStorageService } from './storage/document-storage.service';

@Injectable()
export class DocumentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentService.name);
  private cleaning = false;
  private cleanupTimer?: NodeJS.Timeout;
  constructor(
    @Inject('documentRepository')
    private readonly repository: IDocumentRepository,
    private readonly storage: DocumentStorageService,
  ) {}

  async list(groupId: number, userId: number, query: DocumentQueryDto) {
    return documentListingResponse(
      await this.repository.list(
        groupId,
        userId,
        query.folderId,
        query.memberId,
      ),
    );
  }

  async save(
    groupId: number,
    userId: number,
    input: DocumentInputDto,
    file?: DocumentFile,
    id?: string,
  ) {
    await this.repository.authorize(groupId, userId);
    if (input.name === null)
      throw new BadRequestException('El nombre es obligatorio.');
    const previous = id
      ? await this.repository.find(groupId, userId, id)
      : undefined;
    if (!id && !input.name)
      throw new BadRequestException('El nombre es obligatorio.');
    if (!id || file) validateDocumentFile(file);
    let publication: DocumentPublication | undefined;
    if (file) {
      const path = `${groupId}/${randomUUID()}`;
      // Persist intent BEFORE Storage: even an interrupted request can be cleaned up.
      await this.repository.reserve(groupId, userId, path);
      await this.storage.upload(path, file.buffer, file.mimetype);
      publication = { path, mimeType: file.mimetype, size: file.buffer.length };
    }
    return documentResponse(
      await this.repository.save(groupId, userId, input, publication, previous),
    );
  }

  async status(groupId: number, userId: number, id: string) {
    const document = await this.repository.find(groupId, userId, id);
    return documentStatusResponse(document);
  }

  async download(
    groupId: number,
    userId: number,
    id: string,
    version?: number,
  ) {
    const document = await this.repository.find(groupId, userId, id);
    if (version !== undefined && document.version !== version)
      throw new ConflictException('El archivo cambió. Volvé a abrirlo.');
    const buffer = await this.storage.download(document.objectPath);
    const current = await this.repository.find(groupId, userId, id);
    if (
      current.objectPath !== document.objectPath ||
      (version !== undefined && current.version !== version)
    )
      throw new ConflictException('El archivo cambió. Volvé a abrirlo.');
    return { buffer, mimeType: document.mimeType };
  }

  deleteDocument(groupId: number, userId: number, id: string) {
    return this.repository.deleteDocument(groupId, userId, id);
  }
  async createFolder(groupId: number, userId: number, dto: FolderInputDto) {
    return folderResponse(
      await this.repository.createFolder(
        groupId,
        userId,
        dto.name,
        dto.parentId,
      ),
    );
  }
  async renameFolder(
    groupId: number,
    userId: number,
    id: string,
    dto: FolderInputDto,
  ) {
    return folderResponse(
      await this.repository.renameFolder(groupId, userId, id, dto.name),
    );
  }
  deleteFolder(groupId: number, userId: number, id: string) {
    return this.repository.deleteFolder(groupId, userId, id);
  }

  onModuleInit() {
    this.cleanupTimer = setInterval(
      () => {
        void this.cleanupAbandonedUploads();
      },
      60 * 60 * 1000,
    );
    this.cleanupTimer.unref();
  }
  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async cleanupAbandonedUploads() {
    if (this.cleaning) return;
    this.cleaning = true;
    try {
      for (const path of await this.repository.abandonedPaths()) {
        try {
          await this.storage.remove(path);
          await this.repository.forgetPending(path);
        } catch {
          this.logger.error(
            'Falló la limpieza de una carga de documentos; se reintentará.',
          );
        }
      }
    } catch {
      this.logger.error(
        'No se pudo consultar el registro de cargas pendientes.',
      );
    } finally {
      this.cleaning = false;
    }
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FamilyDocument, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveDocumentData } from '../interface/save-document.interface';
import { DocumentPublication } from '../interface/document-publication.interface';
import { IDocumentRepository } from './document.repository.interface';

@Injectable()
export class DocumentPrismaRepository implements IDocumentRepository {
  constructor(private readonly db: PrismaService) {}

  private async access(
    tx: Prisma.TransactionClient,
    groupId: number,
    userId: number,
  ) {
    const membership = await tx.member.findFirst({
      where: { groupId, userId, group: { deletedAt: null } },
    });
    if (!membership)
      throw new ForbiddenException('No pertenecés a este grupo.');
  }

  authorize(groupId: number, userId: number) {
    return this.access(this.db, groupId, userId);
  }

  // Serialize tree mutations per group; membership is checked again after an upload.
  private transaction<T>(
    groupId: number,
    userId: number,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Group" WHERE "id" = ${groupId} FOR UPDATE`;
      await this.access(tx, groupId, userId);
      return fn(tx);
    });
  }

  async list(
    groupId: number,
    userId: number,
    folderId?: string,
    memberId?: number,
  ) {
    return this.transaction(groupId, userId, async (tx) => {
      if (folderId) await this.folder(tx, groupId, folderId);
      const documents = await tx.familyDocument.findMany({
        where: {
          groupId,
          ...(memberId ? { memberId } : { folderId: folderId ?? null }),
        },
        orderBy: { name: 'asc' },
      });
      const folders = await tx.documentFolder.findMany({
        where: { groupId },
        orderBy: { name: 'asc' },
      });
      const members = await tx.member.findMany({
        where: { groupId },
        select: { id: true, user: { select: { name: true } } },
      });
      const formerMembers = await tx.familyDocument.findMany({
        where: { groupId, memberId: { notIn: members.map((m) => m.id) } },
        distinct: ['memberId'],
        select: { memberId: true, memberName: true },
      });
      return {
        documents,
        folders,
        members: [
          ...members.map((m) => ({
            id: m.id,
            name: m.user.name,
            active: true,
          })),
          ...formerMembers.flatMap((m) =>
            m.memberId === null || m.memberName === null
              ? []
              : [
                  {
                    id: m.memberId,
                    name: m.memberName,
                    active: false,
                  },
                ],
          ),
        ],
      };
    });
  }

  async find(groupId: number, userId: number, id: string) {
    await this.authorize(groupId, userId);
    const document = await this.db.familyDocument.findFirst({
      where: { id, groupId },
    });
    if (!document) throw new NotFoundException('El documento no existe.');
    return document;
  }

  async reserve(groupId: number, userId: number, path: string) {
    await this.transaction(groupId, userId, async (tx) => {
      await tx.documentObject.create({ data: { path } });
    });
  }

  private async folder(
    tx: Prisma.TransactionClient,
    groupId: number,
    id: string,
  ) {
    const folder = await tx.documentFolder.findFirst({
      where: { id, groupId },
    });
    if (!folder)
      throw new NotFoundException(
        'La carpeta no pertenece al grupo o ya no existe.',
      );
    return folder;
  }

  async save(
    groupId: number,
    userId: number,
    input: SaveDocumentData,
    publication?: DocumentPublication,
    previous?: FamilyDocument,
  ) {
    return this.transaction(groupId, userId, async (tx) => {
      const folderId =
        input.folderId !== undefined
          ? input.folderId
          : (previous?.folderId ?? null);
      if (folderId) await this.folder(tx, groupId, folderId);
      const memberId =
        input.memberId !== undefined
          ? input.memberId
          : (previous?.memberId ?? null);
      if (!(input.name ?? previous?.name))
        throw new BadRequestException('El nombre es obligatorio.');
      const member =
        memberId === null
          ? null
          : await tx.member.findFirst({
              where: { id: memberId, groupId },
              include: { user: true },
            });
      if (
        memberId !== null &&
        !member &&
        (!previous ||
          (input.memberId !== undefined &&
            input.memberId !== previous.memberId))
      )
        throw new BadRequestException('El integrante no pertenece al grupo.');
      const metadata = {
        name: input.name ?? previous!.name,
        memberId,
        memberName:
          memberId === null
            ? null
            : (member?.user.name ?? previous!.memberName),
        folderId,
      };
      let result: FamilyDocument;
      if (previous) {
        const updated = await tx.familyDocument.updateMany({
          where: { id: previous.id, groupId, version: previous.version },
          data: {
            ...metadata,
            ...(publication
              ? {
                  objectPath: publication.path,
                  mimeType: publication.mimeType,
                  size: publication.size,
                }
              : {}),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw new ConflictException(
            'El documento cambió. Actualizá el listado y reintentá.',
          );
        result = await tx.familyDocument.findUniqueOrThrow({
          where: { id: previous.id },
        });
        if (publication)
          await tx.documentObject.update({
            where: { path: previous.objectPath },
            data: { state: 'retired', retiredAt: new Date() },
          });
      } else {
        if (!publication) throw new BadRequestException('Archivo obligatorio.');
        result = await tx.familyDocument.create({
          data: {
            ...metadata,
            groupId,
            creatorId: userId,
            objectPath: publication.path,
            mimeType: publication.mimeType,
            size: publication.size,
          },
        });
      }
      if (publication) {
        const activated = await tx.documentObject.updateMany({
          where: {
            path: publication.path,
            state: 'pending',
            createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
          },
          data: { state: 'active' },
        });
        if (activated.count !== 1)
          throw new ConflictException('La carga expiró. Reintentá.');
      }
      return result;
    });
  }

  async deleteDocument(groupId: number, userId: number, id: string) {
    await this.transaction(groupId, userId, async (tx) => {
      const document = await tx.familyDocument.findFirst({
        where: { groupId, id },
      });
      if (!document) throw new NotFoundException('El documento no existe.');
      await tx.documentObject.update({
        where: { path: document.objectPath },
        data: { state: 'retired', retiredAt: new Date() },
      });
      await tx.familyDocument.delete({ where: { id } });
    });
  }

  createFolder(
    groupId: number,
    userId: number,
    name: string,
    parentId?: string,
  ) {
    return this.transaction(groupId, userId, async (tx) => {
      if (parentId) await this.folder(tx, groupId, parentId);
      return tx.documentFolder.create({ data: { groupId, name, parentId } });
    });
  }

  renameFolder(groupId: number, userId: number, id: string, name: string) {
    return this.transaction(groupId, userId, async (tx) => {
      await this.folder(tx, groupId, id);
      return tx.documentFolder.update({ where: { id }, data: { name } });
    });
  }

  async deleteFolder(groupId: number, userId: number, id: string) {
    await this.transaction(groupId, userId, async (tx) => {
      await this.folder(tx, groupId, id);
      const tree = await tx.documentFolder.findMany({
        where: { groupId },
        select: { id: true, parentId: true },
      });
      const ids = new Set([id]);
      for (let size = 0; size !== ids.size;) {
        size = ids.size;
        for (const f of tree)
          if (f.parentId && ids.has(f.parentId)) ids.add(f.id);
      }
      const docs = await tx.familyDocument.findMany({
        where: { groupId, folderId: { in: [...ids] } },
        select: { objectPath: true },
      });
      await tx.documentObject.updateMany({
        where: { path: { in: docs.map((d) => d.objectPath) } },
        data: { state: 'retired', retiredAt: new Date() },
      });
      await tx.documentFolder.delete({ where: { id } });
    });
  }

  async abandonedPaths() {
    const rows = await this.db.documentObject.findMany({
      where: {
        OR: [
          {
            state: 'pending',
            createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          {
            state: 'retired',
            retiredAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        ],
        document: null,
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return rows.map((r) => r.path);
  }
  async forgetPending(path: string) {
    await this.db.documentObject.deleteMany({
      where: { path, state: { in: ['pending', 'retired'] }, document: null },
    });
  }
}

import { DocumentFolder, FamilyDocument } from '@prisma/client';
import { SaveDocumentData } from '../interface/save-document.interface';
import { DocumentPublication } from '../interface/document-publication.interface';
import { DocumentListingEntity } from '../entity/document-listing.entity';

export interface IDocumentRepository {
  authorize(groupId: number, userId: number): Promise<void>;
  list(
    groupId: number,
    userId: number,
    folderId?: string,
    memberId?: number,
  ): Promise<DocumentListingEntity>;
  find(groupId: number, userId: number, id: string): Promise<FamilyDocument>;
  reserve(groupId: number, userId: number, path: string): Promise<void>;
  save(
    groupId: number,
    userId: number,
    input: SaveDocumentData,
    publication?: DocumentPublication,
    previous?: FamilyDocument,
  ): Promise<FamilyDocument>;
  deleteDocument(groupId: number, userId: number, id: string): Promise<void>;
  createFolder(
    groupId: number,
    userId: number,
    name: string,
    parentId?: string,
  ): Promise<DocumentFolder>;
  renameFolder(
    groupId: number,
    userId: number,
    id: string,
    name: string,
  ): Promise<DocumentFolder>;
  deleteFolder(groupId: number, userId: number, id: string): Promise<void>;
  abandonedPaths(): Promise<string[]>;
  forgetPending(path: string): Promise<void>;
}

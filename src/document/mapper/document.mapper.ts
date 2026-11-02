import { DocumentFolder, FamilyDocument } from '@prisma/client';
import { DocumentResponseDto } from '../dto/document-response.dto';
import { FolderResponseDto } from '../dto/folder-response.dto';
import { DocumentListingDto } from '../dto/document-listing.dto';
import { DocumentStatusResponseDto } from '../dto/document-status-response.dto';
import { DocumentListingEntity } from '../entity/document-listing.entity';

export const documentResponse = (d: FamilyDocument): DocumentResponseDto => ({
  id: d.id,
  name: d.name,
  memberId: d.memberId,
  memberName: d.memberName,
  folderId: d.folderId,
  mimeType: d.mimeType,
  size: d.size,
  version: d.version,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
});
export const folderResponse = (f: DocumentFolder): FolderResponseDto => ({
  id: f.id,
  name: f.name,
  parentId: f.parentId,
});

export const documentListingResponse = (
  listing: DocumentListingEntity,
): DocumentListingDto => ({
  documents: listing.documents.map(documentResponse),
  folders: listing.folders.map(folderResponse),
  members: listing.members,
});

export const documentStatusResponse = (
  document: FamilyDocument,
): DocumentStatusResponseDto => ({
  version: document.version,
  mimeType: document.mimeType,
});

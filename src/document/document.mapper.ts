import { DocumentFolder, FamilyDocument } from '@prisma/client';
import { DocumentResponseDto, FolderResponseDto } from './document.dto';

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

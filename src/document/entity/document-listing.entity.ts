import { DocumentFolder, FamilyDocument } from '@prisma/client';

export interface DocumentListingEntity {
  documents: FamilyDocument[];
  folders: DocumentFolder[];
  members: { id: number; name: string; active: boolean }[];
}

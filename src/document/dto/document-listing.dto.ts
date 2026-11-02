import { DocumentResponseDto } from './document-response.dto';
import { FolderResponseDto } from './folder-response.dto';

export interface DocumentListingDto {
  documents: DocumentResponseDto[];
  folders: FolderResponseDto[];
  members: { id: number; name: string; active: boolean }[];
}

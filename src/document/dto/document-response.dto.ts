export interface DocumentResponseDto {
  id: string;
  name: string;
  memberId: number | null;
  memberName: string | null;
  folderId: string | null;
  mimeType: string;
  size: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

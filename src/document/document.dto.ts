import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';

export class DocumentInputDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? (value === '' ? null : Number(value)) : value,
  )
  @IsInt()
  @Min(1)
  memberId?: number | null;

  // Empty multipart field explicitly moves a document to the root.
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  @IsOptional()
  @IsUUID()
  folderId?: string | null;
}

export class FolderInputDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class DocumentQueryDto {
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @ValidateIf((o: DocumentQueryDto) => o.memberId !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  memberId?: number;
}

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

export interface FolderResponseDto {
  id: string;
  name: string;
  parentId: string | null;
}

export interface DocumentListingDto {
  documents: DocumentResponseDto[];
  folders: FolderResponseDto[];
  members: { id: number; name: string; active: boolean }[];
}

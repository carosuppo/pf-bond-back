import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';

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

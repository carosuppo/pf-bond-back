import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

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

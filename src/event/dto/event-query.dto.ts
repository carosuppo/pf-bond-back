import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class EventQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(9999)
  year!: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}

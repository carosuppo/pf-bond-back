import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class EventQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(9999)
  year!: number;
}

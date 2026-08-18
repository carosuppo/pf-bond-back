import { IsInt, IsPositive } from 'class-validator';

export class SubscribeGroupDto {
  @IsInt()
  @IsPositive()
  groupId!: number;
}

import { IsNotEmpty, IsNumber } from 'class-validator';

export class AddMemberDto {
  @IsNumber()
  @IsNotEmpty()
  groupId!: number;

  @IsNumber()
  @IsNotEmpty()
  userId!: number;
}

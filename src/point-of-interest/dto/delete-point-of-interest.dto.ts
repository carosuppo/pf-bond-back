import { IsInt } from 'class-validator';

export class DeletePointOfInterestDto {
  @IsInt()
  userId!: number;
}

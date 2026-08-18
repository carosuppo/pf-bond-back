import { IsBoolean } from 'class-validator';

export class UpdateLocationSharingDto {
  @IsBoolean({ message: 'enabled must be a boolean.' })
  enabled!: boolean;
}

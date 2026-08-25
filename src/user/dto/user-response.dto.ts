import { GetGroupsResponseDto } from '../../group/dto/get-groups-response.dto';

export class UserResponseDto {
  id!: number;
  name!: string;
  email!: string;
  locationId?: number | null;
  groups!: GetGroupsResponseDto[];
  createdAt?: Date;
  updatedAt?: Date;
}

import type { GetGroupsResponseDto } from '../../group/dto/get-groups-response.dto';

export class UserProfileResponseDto {
  id!: number;
  name!: string;
  email!: string;
  groups!: GetGroupsResponseDto[];
}

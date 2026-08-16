import { GetMemberResponseDto } from '../../member/dto/get-member-response.dto';

export class GetGroupResponseDto {
  id!: number;
  name!: string;
  description?: string | null;
  shareLocationMandatorily!: boolean;
  invitationCode!: string;
  members!: GetMemberResponseDto[];
}

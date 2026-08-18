import { GetMemberEntity } from '../../member/entity/get-member.entity';

export interface GetGroupEntity {
  id: number;
  name: string;
  description?: string | null;
  shareLocationMandatorily: boolean;
  invitationCode: string;
  members: GetMemberEntity[];
}

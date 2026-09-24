import { GetMemberEntity } from '../../member/entity/get-member.entity';

export interface GetGroupEntity {
  id: number;
  name: string;
  image: string;
  description?: string | null;
  shareLocationMandatorily: boolean;
  invitationCode: string;
  members: GetMemberEntity[];
}

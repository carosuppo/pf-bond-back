import { GroupEntity } from '../entity/group.entity';
import { CreateGroupData } from '../interface/create-group.interface';

export interface IGroupRepository {
  create(data: CreateGroupData): Promise<GroupEntity>;
  findByInvitationCode(invitationCode: string): Promise<GroupEntity | null>;
}

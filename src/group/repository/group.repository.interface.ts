import { GroupEntity } from '../entity/group.entity';
import { CreateGroupData } from '../interface/create-group.interface';
import { UpdateGroupData } from '../interface/update-group.interface';

export interface IGroupRepository {
  create(data: CreateGroupData, userId: number): Promise<GroupEntity>;
  findByInvitationCode(invitationCode: string): Promise<GroupEntity | null>;
  update(id: number, updateGroupDto: UpdateGroupData): Promise<GroupEntity>;
  findById(id: number): Promise<GroupEntity | null>;
}

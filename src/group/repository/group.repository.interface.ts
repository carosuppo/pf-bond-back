import { GetGroupEntity } from '../entity/get-group.entity';
import { GroupEntity } from '../entity/group.entity';
import { CreateGroupData } from '../interface/create-group.interface';
import { UpdateGroupData } from '../interface/update-group.interface';

export type LeaveGroupResult =
  | { status: 'notFound' }
  | { status: 'notMember' }
  | { status: 'left'; memberId: number }
  | { status: 'deleted'; memberId: number };

export interface IGroupRepository {
  create(data: CreateGroupData, userId: number): Promise<GroupEntity>;
  findByInvitationCode(invitationCode: string): Promise<GroupEntity | null>;
  findById(id: number): Promise<GroupEntity | null>;
  findGroupWithMembers(id: number): Promise<GetGroupEntity | null>;
  update(id: number, updateGroupDto: UpdateGroupData): Promise<GroupEntity>;
  updateImage(id: number, image: string): Promise<GroupEntity>;
  leave(id: number, userId: number): Promise<LeaveGroupResult>;
  softDelete(id: number): Promise<boolean>;
  findById(id: number): Promise<GroupEntity | null>;
  findByUserId(userId: number): Promise<GroupEntity[]>;
}

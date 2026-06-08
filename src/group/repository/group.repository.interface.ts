import { Group } from '@prisma/client';
import { CreateGroupDto } from '../dto/create-group.dto';

export interface IGroupRepository {
  create(dto: CreateGroupDto): Promise<Group>;
}

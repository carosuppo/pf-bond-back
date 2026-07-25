import { Inject, Injectable } from '@nestjs/common';
import type { IGroupRepository } from '../repository/group.repository.interface';

@Injectable()
export class InvitationCodeValidator {
  constructor(
    @Inject('groupRepository')
    private readonly groupRepository: IGroupRepository,
  ) {}

  async isAvailable(invitationCode: string): Promise<boolean> {
    const existingGroup =
      await this.groupRepository.findByInvitationCode(invitationCode);

    return !existingGroup;
  }
}

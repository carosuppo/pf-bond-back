import { Injectable, PipeTransform } from '@nestjs/common';
import { JoinGroupDto } from '../dto/join-group.dto';
import { normalizeInvitationCode } from '../utils/invitation-code.util';

@Injectable()
export class NormalizeInvitationCodePipe implements PipeTransform<
  JoinGroupDto,
  JoinGroupDto
> {
  transform(joinGroupDto: JoinGroupDto): JoinGroupDto {
    return {
      ...joinGroupDto,
      invitationCode: normalizeInvitationCode(joinGroupDto.invitationCode),
    };
  }
}

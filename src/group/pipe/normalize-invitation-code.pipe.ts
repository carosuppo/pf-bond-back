import { Injectable, PipeTransform } from '@nestjs/common';
import { JoinGroupDto } from '../dto/join-group.dto';

@Injectable()
export class NormalizeInvitationCodePipe implements PipeTransform<
  JoinGroupDto,
  JoinGroupDto
> {
  transform(joinGroupDto: JoinGroupDto): JoinGroupDto {
    return {
      ...joinGroupDto,
      invitationCode: joinGroupDto.invitationCode.trim().toUpperCase(),
    };
  }
}

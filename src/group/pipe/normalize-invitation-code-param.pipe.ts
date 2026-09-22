import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import {
  isValidInvitationCode,
  normalizeInvitationCode,
} from '../utils/invitation-code.util';

@Injectable()
export class NormalizeInvitationCodeParamPipe implements PipeTransform<
  string,
  string
> {
  transform(value: string): string {
    const invitationCode = normalizeInvitationCode(value);

    if (!isValidInvitationCode(invitationCode)) {
      throw new BadRequestException(
        'El código de invitación debe tener 6 caracteres alfanuméricos.',
      );
    }

    return invitationCode;
  }
}

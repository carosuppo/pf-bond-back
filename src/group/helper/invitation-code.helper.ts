import { Injectable } from '@nestjs/common';
import { InvitationCodeValidator } from '../validator/invitation-code.validator';

@Injectable()
export class InvitationCodeHelper {
  constructor(
    private readonly invitationCodeValidator: InvitationCodeValidator,
  ) {}

  async generate(): Promise<string> {
    let invitationCode: string;

    do {
      invitationCode = this.createRandomInvitationCode();
    } while (!(await this.invitationCodeValidator.isAvailable(invitationCode)));

    return invitationCode;
  }

  private createRandomInvitationCode(length = 6): string {
    // Se eliminaron los caracteres ambiguos como 'I', 'O', '1', y '0' para evitar confusiones a los usuarios
    // que después podrían tener problemas al ingresar el código de invitación.
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    return Array.from(
      { length },
      () => characters[Math.floor(Math.random() * characters.length)],
    ).join('');
  }
}

import { Controller, Get, Param, Redirect } from '@nestjs/common';
import { NormalizeInvitationCodeParamPipe } from './pipe/normalize-invitation-code-param.pipe';

interface InvitationRedirect {
  url: string;
  statusCode: number;
}

@Controller('invite')
export class InvitationLinkController {
  @Get(':code')
  @Redirect()
  openApplication(
    @Param('code', NormalizeInvitationCodeParamPipe) invitationCode: string,
  ): InvitationRedirect {
    return {
      url: `bond://invite/${invitationCode}`,
      statusCode: 302,
    };
  }
}

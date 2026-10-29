import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { MailService } from '../../mail/mail.service';
import { MessageResponseDto } from '../../user/dto/message-response.dto';
import type { IUserRepository } from '../../user/repository/user.repository.interface';
import type { IMemberRepository } from '../repository/member.repository.interface';
import { MemberReportReason, ReportMemberDto } from '../dto/report-member.dto';

const memberReportReasonLabels: Record<MemberReportReason, string> = {
  [MemberReportReason.HARASSMENT]: 'Acoso o intimidación',
  [MemberReportReason.INAPPROPRIATE_CONTENT]: 'Contenido inapropiado',
  [MemberReportReason.NONCONSENSUAL_LOCATION]:
    'Compartir ubicación sin consentimiento',
  [MemberReportReason.IMPERSONATION]: 'Suplantación de identidad',
  [MemberReportReason.SPAM_OR_FRAUD]: 'Spam o fraude',
  [MemberReportReason.OTHER]: 'Otro motivo',
};

@Injectable()
export class MemberReportService {
  constructor(
    @Inject('memberRepository')
    private readonly memberRepository: IMemberRepository,
    @Inject('userRepository')
    private readonly userRepository: IUserRepository,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async reportMember(
    memberId: number,
    reporterUserId: number,
    reportMemberDto: ReportMemberDto,
  ): Promise<MessageResponseDto> {
    const member = await this.memberRepository.findById(memberId);
    if (!member) throw new NotFoundException('El miembro no existe.');
    if (member.userId === reporterUserId) {
      throw new BadRequestException('No puedes denunciar tu propia cuenta.');
    }

    const reporterMembership = await this.memberRepository.findByUserAndGroup(
      reporterUserId,
      member.groupId,
    );
    if (!reporterMembership) {
      throw new ForbiddenException('No perteneces a este grupo.');
    }

    const [reporter, reportedUser] = await Promise.all([
      this.userRepository.findById(reporterUserId),
      this.userRepository.findById(member.userId),
    ]);
    if (!reporter || !reportedUser) {
      throw new NotFoundException('El miembro no existe.');
    }

    const reportId = randomUUID();
    const configuredRecipient =
      this.configService.get<string>('UGC_REPORT_EMAIL')?.trim() ||
      this.configService.get<string>('PUBLIC_PRIVACY_EMAIL')?.trim() ||
      'dobletpf@gmail.com';

    await this.mailService.sendUserContentReport(configuredRecipient, {
      reportId,
      reporterUserId,
      reporterEmail: reporter.email,
      reportedUserId: reportedUser.id,
      reportedUserName: reportedUser.name,
      memberId,
      groupId: member.groupId,
      reason: memberReportReasonLabels[reportMemberDto.reason],
      details: reportMemberDto.details?.trim() || null,
      reportedAt: new Date(),
    });

    return {
      message: `Recibimos la denuncia y la revisaremos. Referencia: ${reportId}.`,
    };
  }
}

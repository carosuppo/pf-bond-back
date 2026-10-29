import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { MailService } from '../../mail/mail.service';
import { TERMS_OF_USE_VERSION } from '../../user/constants/terms-of-use.constants';
import type { IUserRepository } from '../../user/repository/user.repository.interface';
import type { IMemberRepository } from '../repository/member.repository.interface';
import { MemberReportReason } from '../dto/report-member.dto';
import { MemberReportService } from './member-report.service';

describe('MemberReportService', () => {
  const createService = (options?: {
    isMember?: boolean;
    targetUserId?: number;
  }) => {
    const memberRepository: Partial<IMemberRepository> = {
      findById: jest.fn().mockResolvedValue({
        id: 8,
        groupId: 12,
        userId: options?.targetUserId ?? 5,
        role: 'MEMBER',
      }),
      findByUserAndGroup: jest
        .fn()
        .mockResolvedValue(options?.isMember === false ? null : { id: 3 }),
    };
    const userRepository: Partial<IUserRepository> = {
      findById: jest.fn((userId: number): Promise<User | null> =>
        Promise.resolve({
          id: userId,
          name: userId === 7 ? 'Reportante' : 'Denunciado',
          email: userId === 7 ? 'reportante@bond.test' : 'denunciado@bond.test',
          passwordHash: 'hash',
          profilePhoto: null,
          profilePhotoPath: null,
          notificationsEnabled: true,
          locationId: null,
          emailVerifiedAt: new Date(),
          ageVerifiedAt: new Date(),
          termsAcceptedAt: new Date(),
          termsAcceptedVersion: TERMS_OF_USE_VERSION,
          lastActivityAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
    };
    const mailService = {
      sendUserContentReport: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'PUBLIC_PRIVACY_EMAIL' ? 'privacidad@bond.test' : undefined,
      ),
    };
    const service = new MemberReportService(
      memberRepository as unknown as IMemberRepository,
      userRepository as unknown as IUserRepository,
      mailService as unknown as MailService,
      configService as unknown as ConfigService,
    );

    return { service, memberRepository, mailService };
  };

  it('validates group membership and sends report details to the moderation contact', async () => {
    const fixture = createService();

    const response = await fixture.service.reportMember(8, 7, {
      reason: MemberReportReason.HARASSMENT,
      details: 'Mensaje amenazante',
    });
    expect(response.message).toContain('Referencia:');

    expect(fixture.memberRepository.findByUserAndGroup).toHaveBeenCalledWith(
      7,
      12,
    );
    expect(fixture.mailService.sendUserContentReport).toHaveBeenCalledWith(
      'privacidad@bond.test',
      expect.objectContaining({
        reporterUserId: 7,
        reportedUserId: 5,
        groupId: 12,
        reason: 'Acoso o intimidación',
        details: 'Mensaje amenazante',
      }),
    );
  });

  it('rejects a report from someone outside the member group', async () => {
    const fixture = createService({ isMember: false });

    await expect(
      fixture.service.reportMember(8, 7, {
        reason: MemberReportReason.OTHER,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(fixture.mailService.sendUserContentReport).not.toHaveBeenCalled();
  });

  it('rejects reports about the reporter themself', async () => {
    const fixture = createService({ targetUserId: 7 });

    await expect(
      fixture.service.reportMember(8, 7, {
        reason: MemberReportReason.OTHER,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(fixture.mailService.sendUserContentReport).not.toHaveBeenCalled();
  });
});

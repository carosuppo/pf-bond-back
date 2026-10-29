import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum MemberReportReason {
  HARASSMENT = 'HARASSMENT',
  INAPPROPRIATE_CONTENT = 'INAPPROPRIATE_CONTENT',
  NONCONSENSUAL_LOCATION = 'NONCONSENSUAL_LOCATION',
  IMPERSONATION = 'IMPERSONATION',
  SPAM_OR_FRAUD = 'SPAM_OR_FRAUD',
  OTHER = 'OTHER',
}

export class ReportMemberDto {
  @IsEnum(MemberReportReason)
  reason!: MemberReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class GroupResponseDto {
  name!: string;
  description?: string | null;
  shareLocationMandatorily!: boolean;
  invitationCode!: string;
}

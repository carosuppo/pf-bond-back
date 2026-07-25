export class GroupResponseDto {
  id!: string;
  name!: string;
  description?: string | null;
  shareLocationMandatorily!: boolean;
  invitationCode!: string;
}

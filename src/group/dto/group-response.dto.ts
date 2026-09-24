export class GroupResponseDto {
  id!: number;
  name!: string;
  image!: string;
  description?: string | null;
  shareLocationMandatorily!: boolean;
  invitationCode!: string;
}

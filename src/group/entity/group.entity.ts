export interface GroupEntity {
  id: number;
  name: string;
  description?: string | null;
  shareLocationMandatorily: boolean;
  invitationCode: string;
}

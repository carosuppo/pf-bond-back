export interface CreateGroupData {
  name: string;
  description?: string | null;
  shareLocationMandatorily: boolean;
  invitationCode: string;
}

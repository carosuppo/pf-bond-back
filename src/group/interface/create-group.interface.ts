export interface CreateGroupData {
  name: string;
  image: string;
  description?: string | null;
  shareLocationMandatorily: boolean;
  invitationCode: string;
}

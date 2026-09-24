export interface GroupEntity {
  id: number;
  name: string;
  image: string;
  description?: string | null;
  shareLocationMandatorily: boolean;
  invitationCode: string;
  deletedAt: Date | null;
}

export class GetMemberInfoResponseDto {
  memberId!: number;
  name!: string;
  profilePhoto!: string | null;
  lastSeenAt!: Date | null;
}

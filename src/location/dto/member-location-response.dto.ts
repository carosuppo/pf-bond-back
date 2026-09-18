export class MemberLocationResponseDto {
  memberId!: number;
  userId!: number;
  name!: string;
  profilePhoto!: string | null;
  latitude!: number;
  longitude!: number;
  accuracy!: number | null;
  capturedAt!: Date | null;
  lastSeenAt!: Date | null;
}

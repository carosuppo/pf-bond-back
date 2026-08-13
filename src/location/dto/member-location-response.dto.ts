export class MemberLocationResponseDto {
  memberId!: number;
  userId!: number;
  name!: string;
  latitude!: number;
  longitude!: number;
  accuracy!: number | null;
  capturedAt!: Date | null;
}

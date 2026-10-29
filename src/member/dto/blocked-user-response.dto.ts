export class BlockedUserResponseDto {
  userId!: number;
  name!: string;
  profilePhoto!: string | null;
  blockedAt!: Date;
}

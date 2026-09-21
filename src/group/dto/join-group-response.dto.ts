export class JoinedGroupResponseDto {
  id!: number;
  name!: string;
}

export class JoinGroupResponseDto {
  message!: string;
  group!: JoinedGroupResponseDto;
}

export class UserResponseDto {
  id!: number;
  name!: string;
  email!: string;
  locationId!: number | null;
  createdAt!: Date;
  updatedAt!: Date;
}

import { RoleEnum } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsEnum(RoleEnum, {
    message: 'El rol debe ser ADMIN o MEMBER.',
  })
  role!: RoleEnum;
}

import { IsNotEmpty, IsNumber } from 'class-validator';

export class AddMemberDto {
  @IsNumber(
    {},
    {
      message: 'El ID del grupo debe ser un número.',
    },
  )
  @IsNotEmpty({
    message: 'El ID del grupo es obligatorio.',
  })
  groupId!: number;

  @IsNumber(
    {},
    {
      message: 'El ID del usuario debe ser un número.',
    },
  )
  @IsNotEmpty({
    message: 'El ID del usuario es obligatorio.',
  })
  userId!: number;
}

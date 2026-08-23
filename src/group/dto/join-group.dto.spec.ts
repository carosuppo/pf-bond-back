import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JoinGroupDto } from './join-group.dto';

describe('JoinGroupDto', () => {
  it('acepta un código de invitación válido', async () => {
    const dto = plainToInstance(JoinGroupDto, {
      invitationCode: 'ABC123',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('falla si el código de invitación está vacío', async () => {
    const dto = plainToInstance(JoinGroupDto, { invitationCode: '' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    expect(errors[0].constraints!.isNotEmpty).toBe(
      'El código de invitación es obligatorio.',
    );
  });

  it('falla si el código de invitación no es un texto', async () => {
    const dto = plainToInstance(JoinGroupDto, { invitationCode: 123456 });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isString');
    expect(errors[0].constraints!.isString).toBe(
      'El código de invitación debe ser un texto.',
    );
  });
});

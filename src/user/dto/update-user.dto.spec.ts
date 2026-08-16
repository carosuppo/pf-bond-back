import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
  it('rechaza un correo con formato inválido', async () => {
    const dto = new UpdateUserDto();
    dto.email = 'correo-invalido';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('acepta un correo válido', async () => {
    const dto = new UpdateUserDto();
    dto.email = 'usuario@mail.com';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rechaza un nombre demasiado corto', async () => {
    const dto = new UpdateUserDto();
    dto.name = 'A';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });
});

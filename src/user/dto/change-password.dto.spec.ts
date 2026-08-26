import { validate } from 'class-validator';
import { ChangePasswordDto } from './change-password.dto';

describe('ChangePasswordDto', () => {
  const buildDto = (): ChangePasswordDto => {
    const dto = new ChangePasswordDto();
    dto.currentPassword = '12345678';
    dto.newPassword = '12345678';
    return dto;
  };

  it('acepta una nueva contraseña dentro del rango', async () => {
    const dto = buildDto();
    dto.newPassword = 'claveValida1';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('acepta una nueva contraseña en el límite inferior de 8 caracteres', async () => {
    const dto = buildDto();
    dto.newPassword = '12345678';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('acepta una nueva contraseña en el límite superior de 16 caracteres', async () => {
    const dto = buildDto();
    dto.newPassword = '1234567890123456';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rechaza una nueva contraseña menor a 8 caracteres', async () => {
    const dto = buildDto();
    dto.newPassword = '1234567';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'newPassword')).toBe(true);
  });

  it('rechaza una nueva contraseña mayor a 16 caracteres', async () => {
    const dto = buildDto();
    dto.newPassword = '12345678901234567';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'newPassword')).toBe(true);
  });

  it('rechaza cuando se omite la nueva contraseña', async () => {
    const dto = buildDto();
    delete (dto as Partial<ChangePasswordDto>).newPassword;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'newPassword')).toBe(true);
  });
});

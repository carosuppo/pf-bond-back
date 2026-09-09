import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PointOfInterestColor } from '@prisma/client';

import { CreatePointOfInterestDto } from './create-point-of-interest.dto';
import { UpdatePointOfInterestDto } from './update-point-of-interest.dto';

describe('PointOfInterest DTOs', () => {
  it.each(Object.values(PointOfInterestColor))(
    'acepta color %s en create y PATCH',
    async (color) => {
      await expect(
        validate(
          plainToInstance(CreatePointOfInterestDto, {
            name: 'Colegio',
            radius: 100,
            latitude: 0,
            longitude: 0,
            color,
          }),
        ),
      ).resolves.toHaveLength(0);
      await expect(
        validate(plainToInstance(UpdatePointOfInterestDto, { color })),
      ).resolves.toHaveLength(0);
    },
  );

  it.each(['PINK', '#ff0000', null, 42])(
    'color inválido %s produce HTTP 400',
    async (color) => {
      const pipe = new ValidationPipe({ transform: true, whitelist: true });
      for (const metatype of [
        CreatePointOfInterestDto,
        UpdatePointOfInterestDto,
      ]) {
        await expect(
          pipe.transform(
            { name: 'Colegio', radius: 100, latitude: 0, longitude: 0, color },
            { type: 'body', metatype },
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    },
  );
  it.each([
    [{ radius: 10, latitude: -34, longitude: -58 }, 'name'],
    [{ name: '   ', radius: 10, latitude: -34, longitude: -58 }, 'name'],
    [{ name: 'Lugar', radius: 0, latitude: -34, longitude: -58 }, 'radius'],
    [{ name: 'Lugar', radius: 10, latitude: 91, longitude: -58 }, 'latitude'],
    [{ name: 'Lugar', radius: 10, latitude: -34, longitude: 181 }, 'longitude'],
  ])('rechaza creación inválida en %s', async (payload, field) => {
    const dto = plainToInstance(CreatePointOfInterestDto, payload);
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === field)).toBe(true);
  });

  it('acepta descripción opcional y transforma espacios a null', async () => {
    const dto = plainToInstance(CreatePointOfInterestDto, {
      name: 'Lugar',
      description: '   ',
      radius: 1,
      latitude: -34,
      longitude: -58,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.description).toBeNull();
  });

  it('acepta PATCH parcial y rechaza un nombre vacío', async () => {
    const partial = plainToInstance(UpdatePointOfInterestDto, { radius: 20 });
    const emptyName = plainToInstance(UpdatePointOfInterestDto, {
      name: '   ',
    });

    await expect(validate(partial)).resolves.toHaveLength(0);
    expect(
      (await validate(emptyName)).some((error) => error.property === 'name'),
    ).toBe(true);
  });
});

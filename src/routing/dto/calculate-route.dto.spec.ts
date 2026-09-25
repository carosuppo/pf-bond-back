import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import 'reflect-metadata';

import { CalculateRouteDto } from './calculate-route.dto';
import { RouteMode } from './route-mode';

describe('CalculateRouteDto', () => {
  it.each(Object.values(RouteMode))('acepta el modo %s', async (mode) => {
    const dto = plainToInstance(CalculateRouteDto, {
      originLatitude: -34.6,
      originLongitude: -58.4,
      mode,
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    { originLatitude: 91, originLongitude: 0, mode: RouteMode.DRIVING },
    { originLatitude: 0, originLongitude: 181, mode: RouteMode.WALKING },
    { originLatitude: 0, originLongitude: 0, mode: 'BIKE' },
  ])('rechaza parámetros inválidos %#', async (payload) => {
    const dto = plainToInstance(CalculateRouteDto, payload);
    expect(await validate(dto)).not.toHaveLength(0);
  });
});

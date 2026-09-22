import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { CalculateRouteDto } from './dto/calculate-route.dto';
import { RouteMode } from './dto/route-mode';
import { OpenRouteServiceProvider } from './open-route-service.provider';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';

describe('Routing', () => {
  const config = { get: jest.fn() };
  let provider: OpenRouteServiceProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === 'OPENROUTESERVICE_API_KEY') return 'test-key';
      if (key === 'OPENROUTESERVICE_BASE_URL') return 'https://ors.test';
      return undefined;
    });
    provider = new OpenRouteServiceProvider(config as unknown as ConfigService);
  });

  afterEach(() => jest.useRealTimers());

  it.each([
    [RouteMode.DRIVING, 'driving-car'],
    [RouteMode.WALKING, 'foot-walking'],
  ])('mapea %s al perfil %s y normaliza lon/lat', async (mode, profile) => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          features: [
            {
              geometry: {
                coordinates: [
                  [-58.4, -34.6],
                  [-58.3, -34.5],
                ],
              },
              properties: { summary: { distance: 1200, duration: 300 } },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(
      provider.calculate(
        { latitude: -34.6, longitude: -58.4 },
        { latitude: -34.5, longitude: -58.3 },
        mode,
      ),
    ).resolves.toEqual({
      points: [
        { latitude: -34.6, longitude: -58.4 },
        { latitude: -34.5, longitude: -58.3 },
      ],
      distanceMeters: 1200,
      durationSeconds: 300,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://ors.test/v2/directions/${profile}/geojson`);
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({
      Authorization: 'test-key',
      'Content-Type': 'application/json',
    });
    expect(options?.body).toBe(
      JSON.stringify({
        coordinates: [
          [-58.4, -34.6],
          [-58.3, -34.5],
        ],
      }),
    );
  });

  it('traduce errores HTTP, respuesta sin ruta y configuración ausente', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ features: [] }), { status: 200 }),
      );
    const args = [
      { latitude: 1, longitude: 2 },
      { latitude: 3, longitude: 4 },
      RouteMode.WALKING,
    ] as const;
    await expect(provider.calculate(...args)).rejects.toThrow(
      BadGatewayException,
    );
    await expect(provider.calculate(...args)).rejects.toThrow(
      UnprocessableEntityException,
    );

    config.get.mockReturnValue(undefined);
    await expect(provider.calculate(...args)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('corta por timeout sin dejar la llamada pendiente', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementation((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });
    const result = provider.calculate(
      { latitude: 1, longitude: 2 },
      { latitude: 3, longitude: 4 },
      RouteMode.DRIVING,
    );
    const expectation = expect(result).rejects.toThrow(GatewayTimeoutException);
    await jest.advanceTimersByTimeAsync(10_000);
    await expectation;
  });

  it('resuelve destino mediante POI accesible y mantiene el módulo protegido', async () => {
    const pointService = {
      getActiveForMember: jest.fn().mockResolvedValue({
        location: { latitude: -34.5, longitude: -58.3 },
      }),
    };
    const routeProvider = { calculate: jest.fn().mockResolvedValue({}) };
    const service = new RoutingService(pointService as never, routeProvider);
    const dto: CalculateRouteDto = {
      originLatitude: -34.6,
      originLongitude: -58.4,
      mode: RouteMode.DRIVING,
    };
    await service.calculateToPoint(3, 5, 7, dto);
    expect(pointService.getActiveForMember).toHaveBeenCalledWith(3, 5, 7);
    expect(routeProvider.calculate).toHaveBeenCalledWith(
      { latitude: -34.6, longitude: -58.4 },
      { latitude: -34.5, longitude: -58.3 },
      RouteMode.DRIVING,
    );
    expect(Reflect.getMetadata('__guards__', RoutingController)).toContain(
      SessionAuthGuard,
    );
  });
});

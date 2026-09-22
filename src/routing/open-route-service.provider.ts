import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RouteMode } from './dto/route-mode';
import type { RouteResponseDto } from './dto/route-response.dto';
import type {
  IRoutingProvider,
  RouteCoordinates,
} from './routing-provider.interface';

const REQUEST_TIMEOUT_MS = 10_000;

@Injectable()
export class OpenRouteServiceProvider implements IRoutingProvider {
  constructor(private readonly configService: ConfigService) {}

  async calculate(
    origin: RouteCoordinates,
    destination: RouteCoordinates,
    mode: RouteMode,
  ): Promise<RouteResponseDto> {
    const apiKey = this.configService.get<string>('OPENROUTESERVICE_API_KEY');

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'El servicio de rutas no está configurado.',
      );
    }

    const profile = mode === RouteMode.DRIVING ? 'driving-car' : 'foot-walking';

    const configuredBaseUrl =
      this.configService.get<string>('OPENROUTESERVICE_BASE_URL') ??
      'https://api.openrouteservice.org';

    const baseUrl = configuredBaseUrl.replace(/\/$/, '');

    const url = `${baseUrl}/v2/directions/${profile}/geojson`;

    const body = {
      coordinates: [
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude],
      ],
    };

    console.log('================ ORS REQUEST ================');
    console.log('URL:', url);
    console.log('Profile:', profile);
    console.log('Origin:', origin);
    console.log('Destination:', destination);
    console.log('Body:', JSON.stringify(body));
    console.log('Timeout:', REQUEST_TIMEOUT_MS, 'ms');
    console.log('=============================================');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const elapsedMs = Date.now() - startedAt;

      console.log('================ ORS RESPONSE ===============');
      console.log('Status:', response.status);
      console.log('OK:', response.ok);
      console.log('Time:', elapsedMs, 'ms');
      console.log('=============================================');

      if (!response.ok) {
        let responseBody = '';

        try {
          responseBody = await response.text();
        } catch {
          responseBody = '<No se pudo leer el body>';
        }

        console.log('================ ORS ERROR BODY =============');
        console.log(responseBody);
        console.log('=============================================');

        if (response.status === 404) {
          throw new UnprocessableEntityException(
            'No se encontró una ruta hasta el punto de interés.',
          );
        }

        throw new BadGatewayException(
          'El servicio externo no pudo calcular la ruta.',
        );
      }

      const payload: unknown = await response.json();

      console.log('ORS payload recibido correctamente.');

      return this.normalize(payload);
    } catch (error: unknown) {
      const elapsedMs = Date.now() - startedAt;

      console.log('================ ORS EXCEPTION ==============');
      console.log('Time:', elapsedMs, 'ms');

      if (error instanceof Error) {
        console.log('Name:', error.name);
        console.log('Message:', error.message);
        console.log('Cause:', error.cause);
      } else {
        console.log('Error:', error);
      }

      console.log('=============================================');

      if (error instanceof UnprocessableEntityException) {
        throw error;
      }

      if (error instanceof BadGatewayException) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new GatewayTimeoutException(
          'El servicio de rutas tardó demasiado en responder.',
        );
      }

      throw new BadGatewayException(
        'No se pudo conectar con el servicio de rutas.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalize(payload: unknown): RouteResponseDto {
    if (!this.isRecord(payload) || !Array.isArray(payload.features)) {
      throw new BadGatewayException(
        'El servicio de rutas devolvió una respuesta inválida.',
      );
    }

    const feature: unknown = payload.features[0];

    if (!this.isRecord(feature)) {
      throw new UnprocessableEntityException(
        'No se encontró una ruta hasta el punto de interés.',
      );
    }

    const geometry = feature.geometry;
    const properties = feature.properties;

    if (
      !this.isRecord(geometry) ||
      !Array.isArray(geometry.coordinates) ||
      !this.isRecord(properties) ||
      !this.isRecord(properties.summary)
    ) {
      throw new BadGatewayException(
        'El servicio de rutas devolvió una respuesta inválida.',
      );
    }

    const points = geometry.coordinates.map((coordinate: unknown) => {
      if (
        !Array.isArray(coordinate) ||
        coordinate.length < 2 ||
        typeof coordinate[0] !== 'number' ||
        typeof coordinate[1] !== 'number'
      ) {
        throw new BadGatewayException(
          'El servicio de rutas devolvió coordenadas inválidas.',
        );
      }

      return {
        latitude: coordinate[1],
        longitude: coordinate[0],
      };
    });

    const { distance, duration } = properties.summary;

    if (
      points.length < 2 ||
      typeof distance !== 'number' ||
      !Number.isFinite(distance) ||
      distance < 0 ||
      typeof duration !== 'number' ||
      !Number.isFinite(duration) ||
      duration < 0
    ) {
      throw new BadGatewayException(
        'El servicio de rutas devolvió una respuesta inválida.',
      );
    }

    console.log('================ ORS NORMALIZED =============');
    console.log('Points:', points.length);
    console.log('Distance:', distance, 'm');
    console.log('Duration:', duration, 's');
    console.log('=============================================');

    return {
      points,
      distanceMeters: distance,
      durationSeconds: duration,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}

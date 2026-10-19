import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logErrorSafely, logSafely } from '../common/logging/error-logging';

import { RouteMode } from './dto/route-mode';
import type { RouteResponseDto } from './dto/route-response.dto';
import type {
  IRoutingProvider,
  RouteCoordinates,
} from './routing-provider.interface';

const REQUEST_TIMEOUT_MS = 10_000;

@Injectable()
export class OpenRouteServiceProvider implements IRoutingProvider {
  private readonly logger = new Logger(OpenRouteServiceProvider.name);

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

      if (!response.ok) {
        logSafely(
          this.logger,
          'error',
          `operation=calculateRoute provider=OpenRouteService outcome=error profile=${profile} upstreamStatus=${response.status} durationMs=${elapsedMs}`,
        );

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

      return this.normalize(payload);
    } catch (error: unknown) {
      const elapsedMs = Date.now() - startedAt;

      if (
        !(error instanceof UnprocessableEntityException) &&
        !(error instanceof BadGatewayException)
      ) {
        logErrorSafely(
          this.logger,
          `operation=calculateRoute provider=OpenRouteService durationMs=${elapsedMs}`,
          error,
        );
      }

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

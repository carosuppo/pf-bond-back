import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SecurityMonitoringConfig {
  constructor(private readonly configService: ConfigService) {}

  get authThreshold(): number {
    return this.getPositiveInteger('SECURITY_AUTH_THRESHOLD', 5);
  }

  get authWindowSeconds(): number {
    return this.getPositiveInteger('SECURITY_AUTH_WINDOW_SECONDS', 600);
  }

  get locationThreshold(): number {
    return this.getPositiveInteger('SECURITY_LOCATION_THRESHOLD', 10);
  }

  get locationWindowSeconds(): number {
    return this.getPositiveInteger('SECURITY_LOCATION_WINDOW_SECONDS', 300);
  }

  get alertCooldownSeconds(): number {
    return this.getPositiveInteger('SECURITY_ALERT_COOLDOWN_SECONDS', 900);
  }

  get alertEmail(): string {
    const value = this.configService
      .get<string>('SECURITY_ALERT_EMAIL')
      ?.trim();

    if (!value) {
      throw new Error(
        'La variable de entorno SECURITY_ALERT_EMAIL no está definida.',
      );
    }

    return value;
  }

  private getPositiveInteger(key: string, defaultValue: number): number {
    const configuredValue = this.configService.get<string>(key);

    if (configuredValue === undefined || configuredValue.trim() === '') {
      return defaultValue;
    }

    const parsedValue = Number(configuredValue);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      throw new Error(
        `La variable de entorno ${key} debe ser un entero positivo.`,
      );
    }

    return parsedValue;
  }
}

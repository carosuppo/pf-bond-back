import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { logErrorSafely } from '../common/logging/error-logging';
import type { IHealthRepository } from './health.repository.interface';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject('healthRepository')
    private readonly healthRepository: IHealthRepository,
  ) {}

  async check(): Promise<void> {
    try {
      await this.healthRepository.checkDatabaseConnection();
    } catch (error: unknown) {
      logErrorSafely(
        this.logger,
        'operation=checkDatabaseConnection outcome=error',
        error,
      );
      throw new ServiceUnavailableException('Service unavailable');
    }
  }
}

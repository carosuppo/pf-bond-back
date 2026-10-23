import { ServiceUnavailableException } from '@nestjs/common';
import { IHealthRepository } from './health.repository.interface';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let repository: jest.Mocked<IHealthRepository>;
  let service: HealthService;

  beforeEach(() => {
    repository = {
      checkDatabaseConnection: jest.fn(),
    };
    service = new HealthService(repository);
  });

  it('completes when the database is available', async () => {
    await expect(service.check()).resolves.toBeUndefined();
    expect(repository.checkDatabaseConnection.mock.calls).toHaveLength(1);
  });

  it('returns service unavailable when the database check fails', async () => {
    repository.checkDatabaseConnection.mockRejectedValue(new Error('offline'));

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

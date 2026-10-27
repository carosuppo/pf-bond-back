import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { IActivityRepository } from './activity.repository.interface';

@Injectable()
export class ActivityService {
  constructor(
    @Inject('activityRepository')
    private readonly repository: IActivityRepository,
  ) {}

  async record(userId: number): Promise<void> {
    try {
      await this.repository.record(userId);
    } catch {
      // Never expose database details or personal data in metrics errors.
      throw new ServiceUnavailableException('Activity could not be recorded');
    }
  }
}

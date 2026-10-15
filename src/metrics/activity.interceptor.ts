import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, concatMap } from 'rxjs';
import type { AuthenticatedRequest } from '../user/interface/authenticated-request.interface';
import type { IActivityRepository } from './activity.repository.interface';

// Closed list: new routes are excluded until their callers have been reviewed.
const ACTIONS = new Set([
  'GroupController.create',
  'GroupController.join',
  'GroupController.update',
  'GroupController.updateImage',
  'MemberController.updateMemberRole',
  'MemberController.removeMember',
  'EventController.create',
  'EventController.update',
  'EventController.cancel',
  'EventController.setLocation',
  'PointOfInterestController.create',
  'PointOfInterestController.update',
  'PointOfInterestController.remove',
  'ExpenseAccountController.create',
  'EventReminderController.setMine',
  'EventReminderController.deleteMine',
  'UserController.updateMe',
  'UserController.changePassword',
  'UserController.updateProfilePhoto',
  'UserController.logout',
]);

@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityInterceptor.name);

  constructor(
    @Inject('activityRepository')
    private readonly repository: IActivityRepository,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const action = `${context.getClass().name}.${context.getHandler().name}`;
    const login = action === 'UserController.login';
    if (!login && !ACTIONS.has(action)) return next.handle();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return next.handle().pipe(
      concatMap(async (result: unknown) => {
        const userId = login ? this.loginUserId(result) : request.user?.id;
        if (userId !== undefined) {
          try {
            await this.repository.record(userId);
          } catch {
            // Metrics must not change the outcome or log personal data/errors.
            this.logger.warn('Activity metric could not be updated');
          }
        }
        return result;
      }),
    );
  }

  private loginUserId(result: unknown): number | undefined {
    if (typeof result !== 'object' || result === null || !('user' in result))
      return undefined;
    const user = result.user;
    return typeof user === 'object' &&
      user !== null &&
      'id' in user &&
      typeof user.id === 'number'
      ? user.id
      : undefined;
  }
}

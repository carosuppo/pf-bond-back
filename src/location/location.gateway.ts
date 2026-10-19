import {
  ForbiddenException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Subscription } from 'rxjs';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocket } from 'ws';
import { logErrorSafely } from '../common/logging/error-logging';
import { GroupEvent, GroupEventService } from '../group/group-event.service';
import { SessionAuthenticationService } from '../user/service/session-authentication.service';
import { ACCOUNT_DELETED_EVENT } from '../user/service/account-deletion.service';
import type { AccountDeletedEvent } from '../user/service/account-deletion.service';
import { AuthenticateLocationSocketDto } from './dto/authenticate-location-socket.dto';
import { SubscribeGroupDto } from './dto/subscribe-group.dto';
import { LocationService } from './location.service';

interface SocketMessage<T> {
  event: string;
  data: T;
}

@WebSocketGateway({
  path: '/location/ws',
})
export class LocationGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  private readonly logger = new Logger(LocationGateway.name);

  private readonly authenticatedUsers = new Map<WebSocket, number>();

  private readonly groupSubscriptions = new Map<number, Set<WebSocket>>();

  private eventSubscription?: Subscription;

  constructor(
    private readonly sessionAuthenticationService: SessionAuthenticationService,

    private readonly locationService: LocationService,

    private readonly groupEventService: GroupEventService,
  ) {}

  onModuleInit(): void {
    this.eventSubscription = this.groupEventService.events$.subscribe((event) =>
      this.broadcast(event),
    );
  }

  onModuleDestroy(): void {
    this.eventSubscription?.unsubscribe();
  }

  handleConnection(client: WebSocket): void {
    this.send(client, {
      event: 'connected',
      data: {},
    });
  }

  handleDisconnect(client: WebSocket): void {
    this.authenticatedUsers.delete(client);

    for (const [groupId, clients] of this.groupSubscriptions) {
      clients.delete(client);

      if (clients.size === 0) {
        this.groupSubscriptions.delete(groupId);
      }
    }
  }

  @OnEvent(ACCOUNT_DELETED_EVENT)
  disconnectDeletedUser(event: AccountDeletedEvent): void {
    for (const membership of event.removedMemberships) {
      try {
        this.groupEventService.publish({
          event: 'memberLocationRemoved',
          data: {
            groupId: membership.groupId,
            memberId: membership.memberId,
            userId: event.userId,
            actorUserId: event.userId,
          },
        });
      } catch (error) {
        logErrorSafely(
          this.logger,
          'operation=publishAccountDeletionRemoval outcome=error',
          error,
        );
      }
    }
    for (const [client, authenticatedUserId] of this.authenticatedUsers) {
      if (authenticatedUserId !== event.userId) continue;
      this.handleDisconnect(client);
      try {
        client.close(1008, 'Account deleted');
      } catch (error) {
        logErrorSafely(
          this.logger,
          'operation=closeDeletedAccountSocket outcome=error',
          error,
        );
      }
    }
  }

  @SubscribeMessage('authenticate')
  async authenticate(
    client: WebSocket,
    data: AuthenticateLocationSocketDto,
  ): Promise<void> {
    try {
      const authentication =
        await this.sessionAuthenticationService.authenticate(data.sessionToken);

      this.authenticatedUsers.set(client, authentication.user.id);

      this.send(client, {
        event: 'authenticated',
        data: {},
      });
    } catch (error: unknown) {
      if (!(error instanceof UnauthorizedException)) {
        logErrorSafely(
          this.logger,
          'operation=authenticate outcome=error',
          error,
        );
      }

      this.send(client, {
        event: 'authenticationFailed',

        data: {
          message: 'Invalid session.',
        },
      });

      client.close(1008, 'Unauthorized');
    }
  }

  @SubscribeMessage('subscribeGroup')
  async subscribeGroup(
    client: WebSocket,
    data: SubscribeGroupDto,
  ): Promise<void> {
    const userId = this.authenticatedUsers.get(client);

    if (!userId) {
      this.send(client, {
        event: 'subscriptionFailed',

        data: {
          message: 'Connection is not authenticated.',
        },
      });

      return;
    }

    try {
      await this.locationService.verifyGroupMembership(userId, data.groupId);

      const clients =
        this.groupSubscriptions.get(data.groupId) ?? new Set<WebSocket>();

      clients.add(client);

      this.groupSubscriptions.set(data.groupId, clients);

      this.send(client, {
        event: 'groupSubscribed',

        data: {
          groupId: data.groupId,
        },
      });
    } catch (error: unknown) {
      if (!(error instanceof ForbiddenException)) {
        logErrorSafely(
          this.logger,
          'operation=subscribeGroup outcome=error',
          error,
        );
      }

      this.send(client, {
        event: 'subscriptionFailed',

        data: {
          groupId: data.groupId,
          message: 'You do not belong to this group.',
        },
      });
    }
  }

  private broadcast(event: GroupEvent): void {
    const clients = this.groupSubscriptions.get(event.data.groupId);

    if (!clients) {
      return;
    }

    for (const client of clients) {
      const authenticatedUserId = this.authenticatedUsers.get(client);

      if (
        event.event === 'memberLeft' &&
        authenticatedUserId === event.data.userId
      ) {
        clients.delete(client);
        continue;
      }

      // Nunca devolverle al usuario
      // sus propios eventos.
      if (
        event.event !== 'groupDeleted' &&
        authenticatedUserId === event.data.actorUserId
      ) {
        continue;
      }

      if (client.readyState === WebSocket.OPEN) {
        this.send(client, event);
      }
    }

    if (event.event === 'groupDeleted') {
      this.groupSubscriptions.delete(event.data.groupId);
    } else if (event.event === 'memberLeft' && clients.size === 0) {
      this.groupSubscriptions.delete(event.data.groupId);
    }
  }

  private send(client: WebSocket, message: SocketMessage<unknown>): void {
    try {
      client.send(JSON.stringify(message));
    } catch (error: unknown) {
      logErrorSafely(this.logger, 'operation=send outcome=error', error);
      throw error;
    }
  }
}

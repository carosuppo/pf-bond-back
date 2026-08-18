import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Subscription } from 'rxjs';
import { WebSocket } from 'ws';
import { SessionAuthenticationService } from '../user/service/session-authentication.service';
import { AuthenticateLocationSocketDto } from './dto/authenticate-location-socket.dto';
import { SubscribeGroupDto } from './dto/subscribe-group.dto';
import { LocationEvent, LocationEventService } from './location-event.service';
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
  private readonly authenticatedUsers = new Map<WebSocket, number>();

  private readonly groupSubscriptions = new Map<number, Set<WebSocket>>();

  private eventSubscription?: Subscription;

  constructor(
    private readonly sessionAuthenticationService: SessionAuthenticationService,

    private readonly locationService: LocationService,

    private readonly locationEventService: LocationEventService,
  ) {}

  onModuleInit(): void {
    this.eventSubscription = this.locationEventService.events$.subscribe(
      (event) => this.broadcast(event),
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
    } catch {
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
    } catch {
      this.send(client, {
        event: 'subscriptionFailed',

        data: {
          groupId: data.groupId,
          message: 'You do not belong to this group.',
        },
      });
    }
  }

  private broadcast(event: LocationEvent): void {
    const clients = this.groupSubscriptions.get(event.data.groupId);

    if (!clients) {
      return;
    }

    for (const client of clients) {
      const authenticatedUserId = this.authenticatedUsers.get(client);

      // Nunca devolverle al usuario
      // sus propios eventos.
      if (authenticatedUserId === event.data.userId) {
        continue;
      }

      if (client.readyState === WebSocket.OPEN) {
        this.send(client, event);
      }
    }
  }

  private send<T>(client: WebSocket, message: SocketMessage<T>): void {
    client.send(JSON.stringify(message));
  }
}

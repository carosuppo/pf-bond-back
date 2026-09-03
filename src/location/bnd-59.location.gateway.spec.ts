import { WebSocket } from 'ws';

import { GroupEventService } from '../group/group-event.service';
import { LocationGateway } from './location.gateway';
import { LocationService } from './location.service';

import { SessionAuthenticationService } from '../user/service/session-authentication.service';

describe('BND-59 - Visualizar ubicación de miembros del grupo - Gateway', () => {
  const makeClient = () => {
    const send = jest.fn();

    const client = {
      send,
      close: jest.fn(),
      readyState: WebSocket.OPEN,
    } as unknown as WebSocket;

    return {
      client,
      send,
    };
  };

  it('no permite suscribirse a un grupo sin autenticación', async () => {
    const verifyGroupMembership = jest.fn();

    const locationService = {
      verifyGroupMembership,
    } as unknown as LocationService;

    const gateway = new LocationGateway(
      {} as SessionAuthenticationService,
      locationService,
      new GroupEventService(),
    );

    const { client, send } = makeClient();

    await gateway.subscribeGroup(client, { groupId: 20 });

    expect(verifyGroupMembership).not.toHaveBeenCalled();

    expect(send).toHaveBeenCalledWith(
      expect.stringContaining('subscriptionFailed'),
    );
  });

  it('verifica que el usuario pertenezca al grupo antes de suscribirlo', async () => {
    const authenticationService = {
      authenticate: jest.fn().mockResolvedValue({
        sessionId: 1,
        user: {
          id: 7,
        },
      }),
    } as unknown as SessionAuthenticationService;

    const verifyGroupMembership = jest.fn().mockResolvedValue(undefined);

    const locationService = {
      verifyGroupMembership,
    } as unknown as LocationService;

    const gateway = new LocationGateway(
      authenticationService,
      locationService,
      new GroupEventService(),
    );

    const { client, send } = makeClient();

    await gateway.authenticate(client, {
      sessionToken: 'token',
    });

    await gateway.subscribeGroup(client, {
      groupId: 20,
    });

    expect(verifyGroupMembership).toHaveBeenCalledWith(7, 20);

    expect(send).toHaveBeenCalledWith(
      expect.stringContaining('groupSubscribed'),
    );
  });

  it('rechaza la suscripción si el usuario no pertenece al grupo', async () => {
    const authenticationService = {
      authenticate: jest.fn().mockResolvedValue({
        sessionId: 1,
        user: {
          id: 7,
        },
      }),
    } as unknown as SessionAuthenticationService;

    const verifyGroupMembership = jest
      .fn()
      .mockRejectedValue(new Error('No pertenece al grupo'));

    const locationService = {
      verifyGroupMembership,
    } as unknown as LocationService;

    const gateway = new LocationGateway(
      authenticationService,
      locationService,
      new GroupEventService(),
    );

    const { client, send } = makeClient();

    await gateway.authenticate(client, {
      sessionToken: 'token',
    });

    send.mockClear();

    await gateway.subscribeGroup(client, {
      groupId: 99,
    });

    expect(verifyGroupMembership).toHaveBeenCalledWith(7, 99);

    expect(send).toHaveBeenCalledWith(
      expect.stringContaining('subscriptionFailed'),
    );

    expect(send).not.toHaveBeenCalledWith(
      expect.stringContaining('groupSubscribed'),
    );
  });
});

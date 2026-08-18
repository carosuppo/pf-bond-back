import { WebSocket } from 'ws';
import { LocationEventService } from './location-event.service';
import { LocationGateway } from './location.gateway';
import { LocationService } from './location.service';
import { SessionAuthenticationService } from '../user/service/session-authentication.service';

describe('LocationGateway', () => {
  const makeClient = () => {
    const send = jest.fn();
    const client = {
      send,
      close: jest.fn(),
      readyState: WebSocket.OPEN,
    } as unknown as WebSocket;
    return { client, send };
  };

  it('does not subscribe an unauthenticated connection', async () => {
    const verifyGroupMembership = jest.fn();
    const locationService = {
      verifyGroupMembership,
    } as unknown as LocationService;
    const gateway = new LocationGateway(
      {} as SessionAuthenticationService,
      locationService,
      new LocationEventService(),
    );
    const { client, send } = makeClient();
    await gateway.subscribeGroup(client, { groupId: 5 });
    expect(verifyGroupMembership).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(
      expect.stringContaining('subscriptionFailed'),
    );
  });

  it('verifies membership before subscribing an authenticated connection', async () => {
    const authenticationService = {
      authenticate: jest
        .fn()
        .mockResolvedValue({ sessionId: 1, user: { id: 7 } }),
    } as unknown as SessionAuthenticationService;
    const verifyGroupMembership = jest.fn().mockResolvedValue(undefined);
    const locationService = {
      verifyGroupMembership,
    } as unknown as LocationService;
    const gateway = new LocationGateway(
      authenticationService,
      locationService,
      new LocationEventService(),
    );
    const { client, send } = makeClient();
    await gateway.authenticate(client, { sessionToken: 'token' });
    await gateway.subscribeGroup(client, { groupId: 5 });
    expect(verifyGroupMembership).toHaveBeenCalledWith(7, 5);
    expect(send).toHaveBeenCalledWith(
      expect.stringContaining('groupSubscribed'),
    );
  });
});

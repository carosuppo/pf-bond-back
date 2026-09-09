import { WebSocket } from 'ws';
import { GroupEventService } from '../group/group-event.service';
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
      new GroupEventService(),
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
      new GroupEventService(),
    );
    const { client, send } = makeClient();
    await gateway.authenticate(client, { sessionToken: 'token' });
    await gateway.subscribeGroup(client, { groupId: 5 });
    expect(verifyGroupMembership).toHaveBeenCalledWith(7, 5);
    expect(send).toHaveBeenCalledWith(
      expect.stringContaining('groupSubscribed'),
    );
  });

  it('broadcasts POI events only to the matching group and excludes the actor', async () => {
    const authenticationService = {
      authenticate: jest
        .fn()
        .mockResolvedValueOnce({ sessionId: 1, user: { id: 7 } })
        .mockResolvedValueOnce({ sessionId: 2, user: { id: 8 } })
        .mockResolvedValueOnce({ sessionId: 3, user: { id: 9 } }),
    } as unknown as SessionAuthenticationService;
    const locationService = {
      verifyGroupMembership: jest.fn().mockResolvedValue(undefined),
    } as unknown as LocationService;
    const events = new GroupEventService();
    const gateway = new LocationGateway(
      authenticationService,
      locationService,
      events,
    );
    const actor = makeClient();
    const recipient = makeClient();
    const otherGroup = makeClient();
    gateway.onModuleInit();

    await gateway.authenticate(actor.client, { sessionToken: 'actor' });
    await gateway.authenticate(recipient.client, { sessionToken: 'recipient' });
    await gateway.authenticate(otherGroup.client, { sessionToken: 'other' });
    await gateway.subscribeGroup(actor.client, { groupId: 5 });
    await gateway.subscribeGroup(recipient.client, { groupId: 5 });
    await gateway.subscribeGroup(otherGroup.client, { groupId: 6 });
    actor.send.mockClear();
    recipient.send.mockClear();
    otherGroup.send.mockClear();

    events.publish({
      event: 'pointOfInterestUpdated',
      data: { groupId: 5, pointOfInterestId: 12, actorUserId: 7 },
    });

    expect(actor.send.mock.calls).toHaveLength(0);
    expect(otherGroup.send.mock.calls).toHaveLength(0);
    expect(recipient.send).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'pointOfInterestUpdated',
        data: { groupId: 5, pointOfInterestId: 12, actorUserId: 7 },
      }),
    );
    gateway.onModuleDestroy();
  });

  it('continues broadcasting existing location events while excluding their actor', async () => {
    const authenticationService = {
      authenticate: jest
        .fn()
        .mockResolvedValueOnce({ sessionId: 1, user: { id: 7 } })
        .mockResolvedValueOnce({ sessionId: 2, user: { id: 8 } }),
    } as unknown as SessionAuthenticationService;
    const locationService = {
      verifyGroupMembership: jest.fn().mockResolvedValue(undefined),
    } as unknown as LocationService;
    const events = new GroupEventService();
    const gateway = new LocationGateway(
      authenticationService,
      locationService,
      events,
    );
    const actor = makeClient();
    const recipient = makeClient();
    gateway.onModuleInit();

    await gateway.authenticate(actor.client, { sessionToken: 'actor' });
    await gateway.authenticate(recipient.client, { sessionToken: 'recipient' });
    await gateway.subscribeGroup(actor.client, { groupId: 5 });
    await gateway.subscribeGroup(recipient.client, { groupId: 5 });
    actor.send.mockClear();
    recipient.send.mockClear();

    events.publish({
      event: 'memberLocationRemoved',
      data: { groupId: 5, memberId: 3, userId: 7, actorUserId: 7 },
    });

    expect(actor.send.mock.calls).toHaveLength(0);
    expect(recipient.send).toHaveBeenCalledTimes(1);
    gateway.onModuleDestroy();
  });
});

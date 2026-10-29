import { Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { GroupEventService } from '../group/group-event.service';
import { LocationGateway } from './location.gateway';
import { LocationService } from './location.service';
import { SessionAuthenticationService } from '../user/service/session-authentication.service';
import type { IUserBlockRepository } from '../member/repository/user-block.repository.interface';

describe('LocationGateway', () => {
  const makeClient = () => {
    const send = jest.fn();
    const close = jest.fn();
    const client = {
      send,
      close,
      readyState: WebSocket.OPEN,
    } as unknown as WebSocket;
    return { client, send, close };
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

  it('does not broadcast a blocked member location to either blocked user', async () => {
    const authenticationService = {
      authenticate: jest
        .fn()
        .mockResolvedValueOnce({ sessionId: 1, user: { id: 7 } })
        .mockResolvedValueOnce({ sessionId: 2, user: { id: 8 } }),
    } as unknown as SessionAuthenticationService;
    const locationService = {
      verifyGroupMembership: jest.fn().mockResolvedValue(undefined),
    } as unknown as LocationService;
    const userBlockRepository = {
      findMutuallyBlockedUserIds: jest.fn((userId: number) =>
        Promise.resolve(userId === 7 ? [8] : userId === 8 ? [7] : []),
      ),
    } as unknown as IUserBlockRepository;
    const events = new GroupEventService();
    const gateway = new LocationGateway(
      authenticationService,
      locationService,
      events,
      userBlockRepository,
    );
    const first = makeClient();
    const second = makeClient();
    gateway.onModuleInit();

    await gateway.authenticate(first.client, { sessionToken: 'first' });
    await gateway.authenticate(second.client, { sessionToken: 'second' });
    await gateway.subscribeGroup(first.client, { groupId: 3 });
    await gateway.subscribeGroup(second.client, { groupId: 3 });

    events.publish({
      event: 'memberLocationUpdated',
      data: {
        groupId: 3,
        actorUserId: 7,
        memberId: 70,
        userId: 7,
        name: 'Persona bloqueada',
        profilePhoto: null,
        latitude: 1,
        longitude: 2,
        accuracy: null,
        capturedAt: new Date(),
        lastSeenAt: new Date(),
      },
    });

    expect(second.send.mock.calls.flat().join(' ')).not.toContain(
      'memberLocationUpdated',
    );
    expect(first.send.mock.calls.flat().join(' ')).not.toContain(
      'memberLocationUpdated',
    );
    gateway.notifyUserBlockChanged({
      blockerUserId: 7,
      blockedUserId: 8,
      isBlocked: true,
    });
    expect(first.send.mock.calls.flat().join(' ')).toContain(
      'memberVisibilityChanged',
    );
    expect(second.send.mock.calls.flat().join(' ')).toContain(
      'memberVisibilityChanged',
    );
    gateway.onModuleDestroy();
  });

  it('logs authentication infrastructure failures without logging the session token', async () => {
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const authenticationService = {
      authenticate: jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('session token leaked'), { code: 'P1001' }),
        ),
    } as unknown as SessionAuthenticationService;
    const gateway = new LocationGateway(
      authenticationService,
      {} as LocationService,
      new GroupEventService(),
    );
    const { client, send, close } = makeClient();

    await gateway.authenticate(client, {
      sessionToken: 'private-session-token',
    });

    expect(send).toHaveBeenCalledWith(
      expect.stringContaining('authenticationFailed'),
    );
    expect(close).toHaveBeenCalledWith(1008, 'Unauthorized');
    expect(logger).toHaveBeenCalledWith(
      'operation=authenticate outcome=error errorType=Error errorCode=P1001',
    );
    const logged = JSON.stringify(logger.mock.calls);
    expect(logged).not.toContain('private-session-token');
    expect(logged).not.toContain('session token leaked');
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

  it('broadcasts group deletion to the actor and members then drops subscriptions', async () => {
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
      event: 'groupDeleted',
      data: { groupId: 5, actorUserId: 7 },
    });

    const serializedEvent = JSON.stringify({
      event: 'groupDeleted',
      data: { groupId: 5, actorUserId: 7 },
    });
    expect(actor.send).toHaveBeenCalledWith(serializedEvent);
    expect(recipient.send).toHaveBeenCalledWith(serializedEvent);

    actor.send.mockClear();
    recipient.send.mockClear();
    events.publish({
      event: 'pointOfInterestUpdated',
      data: { groupId: 5, pointOfInterestId: 12, actorUserId: 9 },
    });

    expect(actor.send).not.toHaveBeenCalled();
    expect(recipient.send).not.toHaveBeenCalled();
    gateway.onModuleDestroy();
  });

  it('revokes group subscriptions for every socket of a departing member', async () => {
    const authenticationService = {
      authenticate: jest
        .fn()
        .mockResolvedValueOnce({ sessionId: 1, user: { id: 7 } })
        .mockResolvedValueOnce({ sessionId: 2, user: { id: 7 } })
        .mockResolvedValueOnce({ sessionId: 3, user: { id: 8 } }),
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
    const first = makeClient();
    const second = makeClient();
    const recipient = makeClient();
    gateway.onModuleInit();
    await gateway.authenticate(first.client, { sessionToken: 'first' });
    await gateway.authenticate(second.client, { sessionToken: 'second' });
    await gateway.authenticate(recipient.client, { sessionToken: 'recipient' });
    await gateway.subscribeGroup(first.client, { groupId: 5 });
    await gateway.subscribeGroup(second.client, { groupId: 5 });
    await gateway.subscribeGroup(recipient.client, { groupId: 5 });
    first.send.mockClear();
    second.send.mockClear();
    recipient.send.mockClear();

    events.publish({
      event: 'memberLeft',
      data: { groupId: 5, memberId: 3, userId: 7, actorUserId: 7 },
    });
    events.publish({
      event: 'pointOfInterestUpdated',
      data: { groupId: 5, pointOfInterestId: 12, actorUserId: 9 },
    });

    expect(first.send).not.toHaveBeenCalled();
    expect(second.send).not.toHaveBeenCalled();
    expect(recipient.send).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({
        event: 'memberLeft',
        data: { groupId: 5, memberId: 3, userId: 7, actorUserId: 7 },
      }),
    );
    expect(recipient.send).toHaveBeenNthCalledWith(
      2,
      JSON.stringify({
        event: 'pointOfInterestUpdated',
        data: { groupId: 5, pointOfInterestId: 12, actorUserId: 9 },
      }),
    );
    gateway.onModuleDestroy();
  });

  it('closes every socket of a deleted account and removes its subscriptions', async () => {
    const authenticationService = {
      authenticate: jest
        .fn()
        .mockResolvedValueOnce({ sessionId: 1, user: { id: 7 } })
        .mockResolvedValueOnce({ sessionId: 2, user: { id: 7 } })
        .mockResolvedValueOnce({ sessionId: 3, user: { id: 8 } }),
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
    const first = makeClient();
    const second = makeClient();
    const recipient = makeClient();
    gateway.onModuleInit();
    await gateway.authenticate(first.client, { sessionToken: 'first' });
    await gateway.authenticate(second.client, { sessionToken: 'second' });
    await gateway.authenticate(recipient.client, { sessionToken: 'recipient' });
    await gateway.subscribeGroup(first.client, { groupId: 5 });
    await gateway.subscribeGroup(second.client, { groupId: 5 });
    await gateway.subscribeGroup(recipient.client, { groupId: 5 });
    first.send.mockClear();
    second.send.mockClear();
    recipient.send.mockClear();

    gateway.disconnectDeletedUser({
      userId: 7,
      removedMemberships: [{ groupId: 5, memberId: 3 }],
    });
    expect(recipient.send).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'memberLocationRemoved',
        data: { groupId: 5, memberId: 3, userId: 7, actorUserId: 7 },
      }),
    );
    recipient.send.mockClear();
    events.publish({
      event: 'pointOfInterestUpdated',
      data: { groupId: 5, pointOfInterestId: 12, actorUserId: 9 },
    });

    expect(first.close).toHaveBeenCalledWith(1008, 'Account deleted');
    expect(second.close).toHaveBeenCalledWith(1008, 'Account deleted');
    expect(first.send).not.toHaveBeenCalled();
    expect(second.send).not.toHaveBeenCalled();
    expect(recipient.send).toHaveBeenCalledTimes(1);
    expect(recipient.close).not.toHaveBeenCalled();
    gateway.onModuleDestroy();
  });

  it('continues closing sockets when publishing or another socket fails', async () => {
    const authenticationService = {
      authenticate: jest
        .fn()
        .mockResolvedValueOnce({ sessionId: 1, user: { id: 7 } })
        .mockResolvedValueOnce({ sessionId: 2, user: { id: 7 } }),
    } as unknown as SessionAuthenticationService;
    const events = new GroupEventService();
    const gateway = new LocationGateway(
      authenticationService,
      {} as LocationService,
      events,
    );
    const first = makeClient();
    const second = makeClient();
    await gateway.authenticate(first.client, { sessionToken: 'first' });
    await gateway.authenticate(second.client, { sessionToken: 'second' });
    jest.spyOn(events, 'publish').mockImplementation(() => {
      throw new Error('publish failure');
    });
    first.close.mockImplementation(() => {
      throw new Error('close failure');
    });

    expect(() =>
      gateway.disconnectDeletedUser({
        userId: 7,
        removedMemberships: [{ groupId: 5, memberId: 3 }],
      }),
    ).not.toThrow();
    expect(first.close).toHaveBeenCalledWith(1008, 'Account deleted');
    expect(second.close).toHaveBeenCalledWith(1008, 'Account deleted');
  });
});

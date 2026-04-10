import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NatsBackplane } from './index.js';
import type { Msg, NatsConnection, Subscription } from '@nats-io/nats-core';
import type { BaseLocalCache } from '../../base/local.js';
import type { BackplaneEvent } from '../../base/backplane.js';
import type { Logger } from '../../types/logger.js';

describe('NatsBackplane', () => {
  const mockSubscription = {
    unsubscribe: vi.fn(),
  } satisfies Partial<Subscription>;

  const mockNats = {
    subscribe: vi.fn().mockReturnValue(mockSubscription),
    publish: vi.fn(),
  } satisfies Partial<NatsConnection>;

  const mockCache = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  } satisfies Partial<BaseLocalCache>;

  const mockLogger = {
    debug: vi.fn(),
  } satisfies Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNats.subscribe.mockReturnValue(mockSubscription);
  });

  it('should subscribe to subject on construction', () => {
    new NatsBackplane({
      nats: mockNats as any,
      subject: 'test-subject',
      cache: mockCache as any,
      logger: mockLogger,
    });

    expect(mockNats.subscribe).toHaveBeenCalledWith('test-subject', { callback: expect.any(Function) });
  });

  it('should process incoming messages via onMessage', () => {
    const backplane = new NatsBackplane({
      nats: mockNats as any,
      subject: 'test-subject',
      cache: mockCache as any,
      logger: mockLogger,
    });

    const onMessage = mockNats.subscribe.mock.calls[0][1].callback;

    const receiveEventSpy = vi.spyOn(backplane as any, 'receiveEvent').mockImplementation(() => {});

    const testEvent = { action: 'delete', key: 'key1' } as BackplaneEvent;
    const fakeMsg = {
      json: vi.fn().mockReturnValue(testEvent),
    } as unknown as Msg;

    onMessage(null, fakeMsg);

    expect(fakeMsg.json).toHaveBeenCalled();
    expect(receiveEventSpy).toHaveBeenCalledWith(testEvent);
  });

  it('should handle and log unexpected errors during onMessage', () => {
    new NatsBackplane({
      nats: mockNats as any,
      subject: 'test-subject',
      cache: mockCache as any,
      logger: mockLogger,
    });

    const onMessage = mockNats.subscribe.mock.calls[0][1].callback;

    const fakeError = new Error('Unexpected error');
    const fakeMsg = {} as Msg;

    onMessage(fakeError, fakeMsg);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      undefined,
      '[onMessage] Unexpected error.',
      'error = ',
      fakeError
    );
  });

  it('should handle and log failed message parsing during onMessage', () => {
    new NatsBackplane({
      nats: mockNats as any,
      subject: 'test-subject',
      cache: mockCache as any,
      logger: mockLogger,
    });

    const onMessage = mockNats.subscribe.mock.calls[0][1].callback;

    const fakeError = new Error('Parse error');
    const fakeMsg = {
      json: vi.fn().mockImplementation(() => { throw fakeError; }),
    } as unknown as Msg;

    onMessage(null, fakeMsg);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      undefined,
      '[onMessage] Failed to parse message.',
      'raw = ',
      fakeMsg,
      'error = ',
      fakeError
    );
  });

  it('should publish events on emit', async () => {
    const backplane = new NatsBackplane({
      nats: mockNats as any,
      subject: 'test-subject',
      cache: mockCache as any,
      logger: mockLogger,
    });

    const event = { action: 'delete', key: 'key1' } as unknown as BackplaneEvent;

    await backplane.emit(event);

    expect(mockNats.publish).toHaveBeenCalledWith('test-subject', JSON.stringify(event));
  });

  it('should unsubscribe on dispose', () => {
    const backplane = new NatsBackplane({
      nats: mockNats as any,
      subject: 'test-subject',
      cache: mockCache as any,
      logger: mockLogger,
    });

    backplane.dispose();

    expect(mockSubscription.unsubscribe).toHaveBeenCalled();
  });

  it('should do nothing if dispose is called without subscription', () => {
    mockNats.subscribe.mockReturnValueOnce(undefined);

    const backplane = new NatsBackplane({
      nats: mockNats as any,
      subject: 'test-subject',
      cache: mockCache as any,
      logger: mockLogger,
    });

    backplane.dispose();

    expect(mockSubscription.unsubscribe).not.toHaveBeenCalled();
  });
});


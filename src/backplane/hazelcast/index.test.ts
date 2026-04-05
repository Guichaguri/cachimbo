import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HazelcastBackplane } from './index.js';
import type { ITopic, Message } from 'hazelcast-client';
import type { BaseLocalCache } from '../../base/local.js';
import type { BackplaneEvent } from '../../base/backplane.js';
import type { Logger } from '../../types/logger.js';

describe('HazelcastBackplane', () => {
  const mockTopic = {
    addMessageListener: vi.fn(),
    removeMessageListener: vi.fn(),
    publish: vi.fn(),
  } satisfies Partial<ITopic<any>>;
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
  });

  it('should add message listener on construction', () => {
    mockTopic.addMessageListener.mockReturnValue('listener-id-123');

    new HazelcastBackplane({
      topic: mockTopic as any,
      cache: mockCache as any,
      logger: mockLogger,
    });

    expect(mockTopic.addMessageListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should process incoming messages via onMessage', () => {
    mockTopic.addMessageListener.mockReturnValue('listener-id-123');

    const backplane = new HazelcastBackplane({
      topic: mockTopic as any,
      cache: mockCache as any,
      logger: mockLogger,
    });

    const onMessage = mockTopic.addMessageListener.mock.calls[0][0];

    const receiveEventSpy = vi.spyOn(backplane as any, 'receiveEvent').mockImplementation(() => {});

    const testEvent = { action: 'delete', key: 'key1' } as BackplaneEvent;
    const fakeMessage: Message<BackplaneEvent> = {
      messageObject: testEvent,
      publishingTime: Date.now(),
      publisherId: 'pub1',
    } as any;

    onMessage(fakeMessage);

    expect(receiveEventSpy).toHaveBeenCalledWith(testEvent);
  });

  it('should publish events on emit', async () => {
    const backplane = new HazelcastBackplane({
      topic: mockTopic as any,
      cache: mockCache as any,
      logger: mockLogger,
    });

    const event = { action: 'delete', key: 'key1' } as BackplaneEvent;

    await backplane.emit(event);

    expect(mockTopic.publish).toHaveBeenCalledWith(event);
  });

  it('should remove listener on dispose', () => {
    mockTopic.addMessageListener.mockReturnValue('listener-id-123');

    const backplane = new HazelcastBackplane({
      topic: mockTopic as any,
      cache: mockCache as any,
      logger: mockLogger,
    });

    backplane.dispose();

    expect(mockTopic.removeMessageListener).toHaveBeenCalledWith('listener-id-123');
  });

  it('should do nothing if dispose is called without listenerId', () => {
    mockTopic.addMessageListener.mockReturnValue(undefined);

    const backplane = new HazelcastBackplane({
      topic: mockTopic as any,
      cache: mockCache as any,
      logger: mockLogger,
    });

    backplane.dispose();

    expect(mockTopic.removeMessageListener).not.toHaveBeenCalled();
  });
});


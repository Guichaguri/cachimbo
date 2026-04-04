import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisBackplane } from './index.js';
import type { RedisClientType } from '@redis/client';
import type { Logger } from '../../types/logger.js';
import type { BackplaneEvent } from '../../base/backplane.js';
import { LocalMapCache } from '../../local/map/index.js';

describe('RedisBackplane', () => {
  const mockClient = {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    publish: vi.fn(),
  } satisfies Partial<RedisClientType>;
  const mockLogger: Logger = {
    debug: vi.fn(),
  };
  const backplane = new RedisBackplane({
    publishClient: mockClient as any,
    subscriptionClient: mockClient as any,
    channel: 'test-channel',
    cache: new LocalMapCache(),
    logger: mockLogger,
  });

  const messageHandler = mockClient.subscribe.mock.calls.find(
    ([channel]) => channel === 'test-channel'
  )?.[1];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should subscribe to the channel on initialization', () => {
    new RedisBackplane({
      publishClient: mockClient as any,
      subscriptionClient: mockClient as any,
      channel: 'sample-channel',
      cache: new LocalMapCache(),
    });

    expect(mockClient.subscribe).toHaveBeenCalledWith('sample-channel', expect.any(Function), false);
  });

  it('should unsubscribe on dispose', () => {
    backplane.dispose();

    expect(mockClient.unsubscribe).toHaveBeenCalledWith('test-channel', expect.any(Function), false);
  });

  it('should publish events to the channel on emit', async () => {
    const event: BackplaneEvent = { action: 'set', key: 'key', data: 'data' };

    await backplane.emit(event);

    expect(mockClient.publish).toHaveBeenCalledWith('test-channel', JSON.stringify(event));
  });

  it('should handle messages on the subscribed channel', () => {
    const event: BackplaneEvent = { action: 'set', key: 'key', data: 'data' };

    messageHandler(JSON.stringify(event));

    expect(mockLogger.debug).not.toHaveBeenCalled();
  });

  it('should log an error for invalid messages', () => {
    messageHandler('invalid-json');

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should ignore messages from other channels', () => {
    const messageHandler = mockClient.subscribe.mock.calls.find(
      ([channel]) => channel === 'test-channel'
    )?.[1];

    messageHandler?.(JSON.stringify({ action: 'test' }));

    expect(mockLogger.debug).not.toHaveBeenCalled();
  });
});

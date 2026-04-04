import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IORedisBackplane } from './index.js';
import type { Redis } from 'ioredis';
import type { Logger } from '../../types/logger.js';
import type { BackplaneEvent } from '../../base/backplane.js';
import { LocalMapCache } from '../../local/map/index.js';

describe('IORedisBackplane', () => {
  const mockClient = {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    publish: vi.fn(),
  } satisfies Partial<Redis>;
  const mockLogger: Logger = {
    debug: vi.fn(),
  };
  const backplane = new IORedisBackplane({
    publishClient: mockClient as any,
    subscriptionClient: mockClient as any,
    channel: 'test-channel',
    cache: new LocalMapCache(),
    logger: mockLogger,
  });

  const messageHandler = mockClient.on.mock.calls.find(
    ([event]) => event === 'message'
  )?.[1];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should subscribe to the channel on initialization', () => {
    new IORedisBackplane({
      publishClient: mockClient as any,
      subscriptionClient: mockClient as any,
      channel: 'sample-channel',
      cache: new LocalMapCache(),
    });

    expect(mockClient.subscribe).toHaveBeenCalledWith('sample-channel');
    expect(mockClient.on).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('should unsubscribe and remove listeners on dispose', () => {
    backplane.dispose();

    expect(mockClient.unsubscribe).toHaveBeenCalledWith('test-channel');
    expect(mockClient.off).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('should publish events to the channel on emit', async () => {
    const event: BackplaneEvent = { action: 'set', key: 'key', data: 'data' };

    await backplane.emit(event);

    expect(mockClient.publish).toHaveBeenCalledWith('test-channel', JSON.stringify(event));
  });

  it('should handle messages on the subscribed channel', () => {
    const event: BackplaneEvent = { action: 'set', key: 'key', data: 'data' };

    messageHandler('test-channel', JSON.stringify(event));

    expect(mockLogger.debug).not.toHaveBeenCalled();
  });

  it('should log an error for invalid messages', () => {
    messageHandler('test-channel', 'invalid-json');

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should ignore messages from other channels', () => {
    messageHandler('other-channel', JSON.stringify({ action: 'test' }));

    expect(mockLogger.debug).not.toHaveBeenCalled();
  });
});

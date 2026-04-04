import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MqttBackplane } from './index.js';
import type { MqttClient } from 'mqtt';
import type { Logger } from '../../types/logger.js';
import type { BackplaneEvent } from '../../base/backplane.js';
import { LocalMapCache } from '../../local/map/index.js';

describe('MqttBackplane', () => {
  const mockClient = {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    publish: vi.fn(),
  } satisfies Partial<MqttClient>;
  const mockLogger: Logger = {
    debug: vi.fn(),
  };
  const backplane = new MqttBackplane({
    client: mockClient as any,
    topic: 'test-topic',
    cache: new LocalMapCache(),
    logger: mockLogger,
  });

  const messageHandler = mockClient.on.mock.calls.find(
    ([event]) => event === 'message'
  )?.[1];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should subscribe to the topic on initialization', () => {
    new MqttBackplane({
      client: mockClient as any,
      topic: 'sample-topic',
      cache: new LocalMapCache(),
    });

    expect(mockClient.subscribe).toHaveBeenCalledWith('sample-topic');
    expect(mockClient.on).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('should unsubscribe and remove listeners on dispose', () => {
    backplane.dispose();

    expect(mockClient.unsubscribe).toHaveBeenCalledWith('test-topic');
    expect(mockClient.off).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('should publish events to the topic on emit', async () => {
    const event: BackplaneEvent = { action: 'set', key: 'key', data: 'data' };

    await backplane.emit(event);

    expect(mockClient.publish).toHaveBeenCalledWith('test-topic', JSON.stringify(event));
  });

  it('should handle messages on the subscribed topic', () => {
    const event: BackplaneEvent = { action: 'set', key: 'key', data: 'data' };

    messageHandler('test-topic', Buffer.from(JSON.stringify(event)));

    expect(mockLogger.debug).not.toHaveBeenCalled();
  });

  it('should log an error for invalid messages', () => {
    messageHandler('test-topic', Buffer.from('invalid-json'));

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should ignore messages from other topics', () => {
    messageHandler('other-topic', Buffer.from(JSON.stringify({ action: 'test' })));

    expect(mockLogger.debug).not.toHaveBeenCalled();
  });

  it('should handle undefined events gracefully', () => {
    messageHandler('test-topic', undefined);

    expect(mockLogger.debug).toHaveBeenCalled();
  });
});

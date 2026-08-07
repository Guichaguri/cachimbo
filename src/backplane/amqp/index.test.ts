import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AmqpBackplane } from './index.js';
import type { ConsumeMessage } from 'amqplib';
import type { BaseLocalCache } from '../../base/local.js';
import type { BackplaneEvent } from '../../base/backplane.js';
import type { Logger } from '../../types/logger.js';

describe('AmqpBackplane', () => {
  const mockChannel = {
    assertExchange: vi.fn().mockResolvedValue(undefined),
    assertQueue: vi.fn().mockResolvedValue({ queue: 'test-queue' }),
    consume: vi.fn().mockResolvedValue({ consumerTag: 'consumer-id-123' }),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockReturnValue(true),
    cancel: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockConnection = {
    createChannel: vi.fn().mockResolvedValue(mockChannel),
  };

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

  const sleep = () => new Promise(resolve => setTimeout(resolve, 0));

  it('should initialize channel, exchange and queue on construction', async () => {
    new AmqpBackplane({
      connection: mockConnection as any,
      exchange: 'test-exchange',
      cache: mockCache as any,
      logger: mockLogger,
    });

    await sleep();

    expect(mockConnection.createChannel).toHaveBeenCalled();
    expect(mockChannel.assertExchange).toHaveBeenCalledWith('test-exchange', 'fanout', { durable: false });
    expect(mockChannel.assertQueue).toHaveBeenCalledWith('', { durable: false, autoDelete: true });
    expect(mockChannel.consume).toHaveBeenCalledWith('test-queue', expect.any(Function), { noAck: true, noLocal: true });
    expect(mockChannel.bindQueue).toHaveBeenCalledWith('test-queue', 'test-exchange', '');
  });

  it('should log initialization errors', async () => {
    mockChannel.assertExchange.mockRejectedValueOnce(new Error('Connection error'));

    const backplane = new AmqpBackplane({
      connection: mockConnection as any,
      exchange: 'test-exchange',
      cache: mockCache as any,
      logger: mockLogger,
    });

    await sleep();

    expect(mockConnection.createChannel).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalled();

    backplane.dispose();
  });

  it('should process incoming messages via onMessage', async () => {
    const backplane = new AmqpBackplane({
      connection: mockConnection as any,
      exchange: 'test-exchange',
      cache: mockCache as any,
      logger: mockLogger,
    });

    await sleep();

    const onMessage = mockChannel.consume.mock.calls[0][1];
    const receiveEventSpy = vi.spyOn(backplane as any, 'receiveEvent').mockImplementation(() => {});

    const testEvent = { action: 'delete', key: 'key1' } as BackplaneEvent;
    const fakeMessage = {
      content: Buffer.from(JSON.stringify(testEvent), 'utf8')
    } as ConsumeMessage;

    onMessage(fakeMessage);

    expect(receiveEventSpy).toHaveBeenCalledWith(testEvent);
  });

  it('should ignore message with null content or parse error', async () => {
    const backplane = new AmqpBackplane({
      connection: mockConnection as any,
      exchange: 'test-exchange',
      cache: mockCache as any,
      logger: mockLogger,
    });

    await sleep();
    const onMessage = mockChannel.consume.mock.calls[0][1];
    const receiveEventSpy = vi.spyOn(backplane as any, 'receiveEvent').mockImplementation(() => {});

    // Null message
    onMessage(null);
    expect(receiveEventSpy).not.toHaveBeenCalled();

    // Invalid JSON
    onMessage({ content: Buffer.from('invalid json') } as ConsumeMessage);
    expect(receiveEventSpy).not.toHaveBeenCalled();
  });

  it('should publish events on emit', async () => {
    const backplane = new AmqpBackplane({
      connection: mockConnection as any,
      exchange: 'test-exchange',
      cache: mockCache as any,
      logger: mockLogger,
    });

    await sleep();

    const event = { action: 'delete', key: 'key1' } as BackplaneEvent;

    await backplane.emit(event);

    expect(mockChannel.publish).toHaveBeenCalledWith('test-exchange', '', Buffer.from(JSON.stringify(event), 'utf8'));
  });

  it('should cancel consumer and close channel on dispose', async () => {
    const backplane = new AmqpBackplane({
      connection: mockConnection as any,
      exchange: 'test-exchange',
      cache: mockCache as any,
      logger: mockLogger,
    });

    await sleep();

    backplane.dispose();

    await sleep();

    expect(mockChannel.cancel).toHaveBeenCalledWith('consumer-id-123');
    expect(mockChannel.close).toHaveBeenCalled();
  });

  it('should wait for the initialization before publishing an event', async () => {
    const backplane = new AmqpBackplane({
      connection: mockConnection as any,
      exchange: 'test-exchange',
      cache: mockCache as any,
      logger: mockLogger,
    });

    const event = { action: 'delete', key: 'key1' } as BackplaneEvent;

    // Emitted before the channel exists, it must still reach the exchange
    await backplane.emit(event);

    expect(mockChannel.publish).toHaveBeenCalledWith('test-exchange', '', Buffer.from(JSON.stringify(event), 'utf8'));
  });

  it('should log instead of publishing when the initialization failed', async () => {
    mockConnection.createChannel.mockRejectedValueOnce(new Error('connection refused'));

    const backplane = new AmqpBackplane({
      connection: mockConnection as any,
      exchange: 'test-exchange',
      cache: mockCache as any,
      logger: mockLogger,
    });

    await backplane.emit({ action: 'delete', key: 'key1' });

    expect(mockChannel.publish).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      undefined,
      '[emit] The channel is not available, the event was not published.',
      'data =', { action: 'delete', key: 'key1' },
    );
  });

  it('should log an error when closing the channel fails on dispose', async () => {
    const backplane = new AmqpBackplane({
      connection: mockConnection as any,
      exchange: 'test-exchange',
      cache: mockCache as any,
      logger: mockLogger,
    });

    await sleep();

    mockChannel.close.mockRejectedValueOnce(new Error('channel already closed'));

    backplane.dispose();

    await vi.waitFor(() => expect(mockLogger.debug).toHaveBeenCalledWith(
      undefined,
      '[dispose] Failed to close the channel.',
      'error =', expect.any(Error),
    ));
  });

  it('should still close the channel when dispose is called during the initialization', async () => {
    let resolveChannel: any;
    mockConnection.createChannel.mockReturnValue(new Promise(res => { resolveChannel = res; }));

    const backplane = new AmqpBackplane({
      connection: mockConnection as any,
      exchange: 'test-exchange',
      cache: mockCache as any,
      logger: mockLogger,
    });

    backplane.dispose();
    await sleep();

    expect(mockChannel.close).not.toHaveBeenCalled();

    resolveChannel(mockChannel);

    // Disposing waits for the initialization, otherwise the channel would be leaked
    await vi.waitFor(() => expect(mockChannel.close).toHaveBeenCalled());
  });

  it('should do nothing on dispose when the initialization failed', async () => {
    mockConnection.createChannel.mockRejectedValueOnce(new Error('connection refused'));

    const backplane = new AmqpBackplane({
      connection: mockConnection as any,
      exchange: 'test-exchange',
      cache: mockCache as any,
      logger: mockLogger,
    });

    backplane.dispose();
    await sleep();

    expect(mockChannel.cancel).not.toHaveBeenCalled();
    expect(mockChannel.close).not.toHaveBeenCalled();
  });
});

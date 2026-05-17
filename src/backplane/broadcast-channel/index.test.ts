import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BroadcastChannelBackplane } from './index.js';
import type { BaseLocalCache } from '../../base/local.js';
import type { BackplaneEvent } from '../../base/backplane.js';

describe('BroadcastChannelBackplane', () => {
  const mockChannel = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    postMessage: vi.fn(),
  } as unknown as BroadcastChannel;

  const mockCache = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  } satisfies Partial<BaseLocalCache>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add message listener on construction', () => {
    new BroadcastChannelBackplane({
      channel: mockChannel,
      cache: mockCache as any,
    });

    expect(mockChannel.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('should process incoming messages via onMessage', () => {
    const backplane = new BroadcastChannelBackplane({
      channel: mockChannel,
      cache: mockCache as any,
    });

    const onMessage = vi.mocked(mockChannel.addEventListener).mock.calls[0][1] as EventListener;

    const receiveEventSpy = vi.spyOn(backplane as any, 'receiveEvent').mockImplementation(() => {});

    const testEvent = { action: 'delete', key: 'key1' } as BackplaneEvent;
    
    // Valid message
    onMessage({
      data: { t: 'bkpln', e: testEvent }
    } as MessageEvent);

    expect(receiveEventSpy).toHaveBeenCalledWith(testEvent);
  });

  it('should ignore invalid messages via onMessage', () => {
    const backplane = new BroadcastChannelBackplane({
      channel: mockChannel,
      cache: mockCache as any,
    });

    const onMessage = vi.mocked(mockChannel.addEventListener).mock.calls[0][1] as EventListener;

    const receiveEventSpy = vi.spyOn(backplane as any, 'receiveEvent').mockImplementation(() => {});

    // Invalid message type (string)
    onMessage({ data: 'invalid' } as MessageEvent);
    // Invalid message format (missing t: 'bkpln')
    onMessage({ data: { t: 'other' } } as MessageEvent);

    expect(receiveEventSpy).not.toHaveBeenCalled();
  });

  it('should publish events on emit', async () => {
    const backplane = new BroadcastChannelBackplane({
      channel: mockChannel,
      cache: mockCache as any,
    });

    const testEvent = { action: 'delete', key: 'key1' } as BackplaneEvent;

    await backplane.emit(testEvent);

    expect(mockChannel.postMessage).toHaveBeenCalledWith({ t: 'bkpln', e: testEvent });
  });

  it('should remove listener on dispose', () => {
    const backplane = new BroadcastChannelBackplane({
      channel: mockChannel,
      cache: mockCache as any,
    });

    backplane.dispose();

    expect(mockChannel.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });
});


import { describe, it, expect, vi } from 'vitest';
import { BaseBackplane } from './backplane.js';
import type { BaseLocalCache } from './local.js';
import type { Logger } from '../types/logger.js';

class MockBackplane extends BaseBackplane {
  emit = vi.fn();
  dispose = vi.fn();
}

class TestableBackplane extends MockBackplane {
  testReceiveEvent(event: any) {
    return this.receiveEvent(event);
  }
}

describe('BaseBackplane', () => {
  const mockCache = {
    get: vi.fn(),
    getOrLoad: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getMany: vi.fn(),
    setMany: vi.fn(),
    deleteMany: vi.fn(),
  } satisfies Partial<BaseLocalCache>;

  const mockLogger = {
    debug: vi.fn(),
  } satisfies Logger;

  const backplane = new MockBackplane({ cache: mockCache as any, logger: mockLogger });
  const testableBackplane = new TestableBackplane({ cache: mockCache as any, logger: mockLogger });

  it('should call cache.get on get', async () => {
    mockCache.get.mockResolvedValueOnce('value');
    const result = await backplane.get('key');
    expect(mockCache.get).toHaveBeenCalledWith('key');
    expect(result).toBe('value');
  });

  it('should call cache.set and emit on set', async () => {
    const emitSpy = vi.spyOn(backplane, 'emit');
    await backplane.set('key', 'value');
    expect(mockCache.set).toHaveBeenCalledWith('key', 'value', undefined);
    expect(emitSpy).toHaveBeenCalledWith({ action: 'set', key: 'key', data: 'value', options: undefined });
  });

  it('should call cache.delete and emit on delete', async () => {
    const emitSpy = vi.spyOn(backplane, 'emit');
    await backplane.delete('key');
    expect(mockCache.delete).toHaveBeenCalledWith('key');
    expect(emitSpy).toHaveBeenCalledWith({ action: 'delete', key: 'key' });
  });

  it('should call cache.getMany on getMany', async () => {
    mockCache.getMany.mockResolvedValueOnce({ key1: 'value1', key2: 'value2' });
    const result = await backplane.getMany(['key1', 'key2']);
    expect(mockCache.getMany).toHaveBeenCalledWith(['key1', 'key2']);
    expect(result).toEqual({ key1: 'value1', key2: 'value2' });
  });

  it('should call cache.setMany and emit on setMany', async () => {
    const emitSpy = vi.spyOn(backplane, 'emit');
    const data = { key1: 'value1', key2: 'value2' };
    await backplane.setMany(data);
    expect(mockCache.setMany).toHaveBeenCalledWith(data, undefined);
    expect(emitSpy).toHaveBeenCalledWith({ action: 'setMany', data, options: undefined });
  });

  it('should call cache.deleteMany and emit on deleteMany', async () => {
    const emitSpy = vi.spyOn(backplane, 'emit');
    const keys = ['key1', 'key2'];
    await backplane.deleteMany(keys);
    expect(mockCache.deleteMany).toHaveBeenCalledWith(keys);
    expect(emitSpy).toHaveBeenCalledWith({ action: 'deleteMany', keys });
  });

  it('should call cache.getOrLoad with loadWrapped', async () => {
    const load = vi.fn().mockResolvedValue('loaded-data');
    mockCache.getOrLoad.mockResolvedValueOnce('cached-data');
    const emitSpy = vi.spyOn(backplane, 'emit');

    const result = await backplane.getOrLoad('key', load, { ttl: 100 });

    expect(mockCache.getOrLoad).toHaveBeenCalledWith(
      'key',
      expect.any(Function),
      { ttl: 100 }
    );
    expect(result).toBe('cached-data');

    const loadWrapped = mockCache.getOrLoad.mock.calls[mockCache.getOrLoad.mock.calls.length - 1][1] as () => Promise<any>;
    const loadResult = await loadWrapped();

    expect(load).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledWith({ action: 'set', key: 'key', data: 'loaded-data', options: { ttl: 100 } });
    expect(loadResult).toBe('loaded-data');
  });

  it('should handle delete event in receiveEvent', async () => {
    await testableBackplane.testReceiveEvent({ action: 'delete', key: 'key' });
    expect(mockCache.delete).toHaveBeenCalledWith('key');
  });

  it('should handle setMany event in receiveEvent', async () => {
    await testableBackplane.testReceiveEvent({ action: 'setMany', data: { key1: 'val1' }, options: undefined });
    expect(mockCache.setMany).toHaveBeenCalledWith({ key1: 'val1' }, undefined);
  });

  it('should handle deleteMany event in receiveEvent', async () => {
    await testableBackplane.testReceiveEvent({ action: 'deleteMany', keys: ['key1'] });
    expect(mockCache.deleteMany).toHaveBeenCalledWith(['key1']);
  });

  it('should handle unknown events in receiveEvent', async () => {
    const unknownEvent = { action: 'unknown', key: 'key' } as any;

    await testableBackplane.testReceiveEvent(unknownEvent);

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should log an error when receiveEvent fails', async () => {
    const failingEvent = { action: 'set', key: 'key', data: 'data' } as any;
    mockCache.set.mockRejectedValueOnce(new Error('Cache error'));

    await testableBackplane.testReceiveEvent(failingEvent);

    expect(mockLogger.debug).toHaveBeenCalled();
  });
});

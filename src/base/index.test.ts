import { describe, expect, test, vi } from 'vitest';
import { BaseCache } from './index.js';

class MockedCache extends BaseCache {
  constructor() {
    super({ logger: { debug: vi.fn() } });
  }
  get = vi.fn().mockReturnValue(null);
  set = vi.fn();
  delete = vi.fn();
}

describe('BaseCache', () => {

  describe('getOrLoad', () => {
    test('should load when no result is found', async () => {
      const cache = new MockedCache();
      const load = vi.fn().mockReturnValue('result');
      const options = { ttl: 30 };

      const result = await cache.getOrLoad('sample', load, options);

      expect(result).toBe('result');
      expect(cache.get).toHaveBeenCalledWith('sample');
      expect(cache.set).toHaveBeenCalledWith('sample', 'result', options);
    });

    test('should not load when a result is found', async () => {
      const cache = new MockedCache();
      cache.get.mockReturnValueOnce('existing');
      const load = vi.fn().mockReturnValue('another');

      const result = await cache.getOrLoad('key', load, { ttl: 50 });

      expect(result).toBe('existing');
      expect(cache.get).toHaveBeenCalledWith('key');
      expect(cache.set).not.toHaveBeenCalled();
    });
  });

  describe('getMany', () => {
    test('should get all keys', async () => {
      const cache = new MockedCache();
      const items: Record<string, string> = {
        'key1': 'value1',
        'key2': 'sample',
        'key3': 'another',
      };
      cache.get.mockImplementation((key) => items[key] ?? null);

      const result = await cache.getMany(['key1', 'key2', 'key4']);

      expect(result).toEqual({
        'key1': 'value1',
        'key2': 'sample',
        'key4': null,
      });
      expect(cache.get).toHaveBeenCalledWith('key1');
      expect(cache.get).toHaveBeenCalledWith('key2');
      expect(cache.get).toHaveBeenCalledWith('key4');
    });
  });

  describe('setMany', () => {
    test('should set all keys', async () => {
      const cache = new MockedCache();
      const items: Record<string, string> = {
        'key1': 'value1',
        'key2': 'sample',
        'key3': 'another',
      };
      const options = { ttl: 30 };

      await cache.setMany(items, options);

      expect(cache.set).toHaveBeenCalledWith('key1', 'value1', options);
      expect(cache.set).toHaveBeenCalledWith('key2', 'sample', options);
      expect(cache.set).toHaveBeenCalledWith('key3', 'another', options);
    });
  });

  describe('deleteMany', () => {
    test('should delete all keys', async () => {
      const cache = new MockedCache();

      await cache.deleteMany(['key1', 'key2', 'key4']);

      expect(cache.delete).toHaveBeenCalledWith('key1');
      expect(cache.delete).toHaveBeenCalledWith('key2');
      expect(cache.delete).toHaveBeenCalledWith('key4');
    });
  });

});

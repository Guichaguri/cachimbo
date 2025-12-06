import { beforeEach, describe, expect, test, vi } from 'vitest';
import { LocalLRUCache } from './index.js';

const mockLRUCache = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  fetch: vi.fn(),
} as any;

describe('LocalLRUCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('initializes with provided LRU cache instance', () => {
      expect(() => new LocalLRUCache({ cache: mockLRUCache })).not.toThrow();
    });

    test('initializes with default options', () => {
      expect(() => new LocalLRUCache()).not.toThrow();
    });

    test('initializes with basic options', () => {
      expect(() => new LocalLRUCache({ ttl: 30, max: 100 })).not.toThrow();
    });
  })

  describe('get', () => {
    test('returns the value for an existing key', async () => {
      const cache = new LocalLRUCache({ cache: mockLRUCache });
      mockLRUCache.get.mockReturnValueOnce('value');

      const result = await cache.get('existing-key');

      expect(result).toBe('value');
      expect(mockLRUCache.get).toHaveBeenCalledWith('existing-key');
    });

    test('returns null for a non-existing key', async () => {
      const cache = new LocalLRUCache({ cache: mockLRUCache });
      mockLRUCache.get.mockReturnValueOnce(undefined);

      const result = await cache.get('non-existing-key');

      expect(result).toBeNull();
      expect(mockLRUCache.get).toHaveBeenCalledWith('non-existing-key');
    });
  });

  describe('getOrLoad', () => {
    test('loads the value when not found and shouldUseFetch is true', async () => {
      const cache = new LocalLRUCache({ cache: mockLRUCache, shouldUseFetch: true });
      const load = vi.fn().mockResolvedValue('loaded-value');
      mockLRUCache.fetch.mockResolvedValueOnce('loaded-value');

      const result = await cache.getOrLoad('key', load, { ttl: 30 });

      expect(result).toBe('loaded-value');
      expect(mockLRUCache.fetch).toHaveBeenCalledWith('key', {
        context: load,
        ttl: 30000,
      });
    });

    test('uses BaseCache getOrLoad when shouldUseFetch is false', async () => {
      const cache = new LocalLRUCache({ cache: mockLRUCache, shouldUseFetch: false });
      const load = vi.fn().mockResolvedValue('loaded-value');
      mockLRUCache.get.mockReturnValueOnce(null);

      const result = await cache.getOrLoad('key', load, { ttl: 30 });

      expect(result).toBe('loaded-value');
      expect(mockLRUCache.get).toHaveBeenCalledWith('key');
    });

    test('calls fetchMethod when shouldUseFetch is true', async () => {
      const cache = new LocalLRUCache();
      const load = vi.fn().mockResolvedValue('sample-value');

      const result = await cache.getOrLoad('key', load);

      expect(result).toBe('sample-value');
      expect(load).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    test('stores the value with the specified TTL', async () => {
      const cache = new LocalLRUCache({ cache: mockLRUCache });
      const value = { key: 'value' };

      await cache.set('key', value, { ttl: 60 });

      expect(mockLRUCache.set).toHaveBeenCalledWith('key', value, { ttl: 60000 });
    });

    test('stores the value without TTL when not specified', async () => {
      const cache = new LocalLRUCache({ cache: mockLRUCache });
      const value = { key: 'value' };

      await cache.set('key', value);

      expect(mockLRUCache.set).toHaveBeenCalledWith('key', value, { ttl: undefined });
    });
  });

  describe('delete', () => {
    test('removes the key from the cache', async () => {
      const cache = new LocalLRUCache({ cache: mockLRUCache });

      await cache.delete('key');

      expect(mockLRUCache.delete).toHaveBeenCalledWith('key');
    });
  });
});

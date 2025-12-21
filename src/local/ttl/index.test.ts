import { beforeEach, describe, expect, test, vi } from 'vitest';
import { LocalTTLCache } from './index.js';

const mockTTLCache = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
} as any;

describe('LocalTTLCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('creates an instance passing basic options', () => {
      expect(() => new LocalTTLCache({ max: 100, ttl: 30 })).not.toThrow();
    });

    test('creates an instance without passing options', () => {
      expect(() => new LocalTTLCache()).not.toThrow();
    });

    test('creates an instance passing an existing cache', () => {
      expect(() => new LocalTTLCache({ cache: mockTTLCache })).not.toThrow();
    });
  });

  describe('get', () => {
    test('returns the value for an existing key', async () => {
      const cache = new LocalTTLCache({ cache: mockTTLCache });
      mockTTLCache.get.mockReturnValueOnce('value');

      const result = await cache.get('existing-key');

      expect(result).toBe('value');
      expect(mockTTLCache.get).toHaveBeenCalledWith('existing-key');
    });

    test('returns null for a non-existing key', async () => {
      const cache = new LocalTTLCache({ cache: mockTTLCache });
      mockTTLCache.get.mockReturnValueOnce(undefined);

      const result = await cache.get('non-existing-key');

      expect(result).toBeNull();
      expect(mockTTLCache.get).toHaveBeenCalledWith('non-existing-key');
    });
  });

  describe('set', () => {
    test('stores the value with the specified TTL', async () => {
      const cache = new LocalTTLCache({ cache: mockTTLCache });
      const value = { key: 'value' };

      await cache.set('key', value, { ttl: 60 });

      expect(mockTTLCache.set).toHaveBeenCalledWith('key', value, { ttl: 60000 });
    });

    test('stores the value without TTL when not specified', async () => {
      const cache = new LocalTTLCache({ cache: mockTTLCache });
      const value = { key: 'value' };

      await cache.set('key', value);

      expect(mockTTLCache.set).toHaveBeenCalledWith('key', value, { ttl: undefined });
    });
  });

  describe('delete', () => {
    test('removes the key from the cache', async () => {
      const cache = new LocalTTLCache({ cache: mockTTLCache });

      await cache.delete('key');

      expect(mockTTLCache.delete).toHaveBeenCalledWith('key');
    });

    test('calls dispose when deleting', async () => {
      const cache = new LocalTTLCache({ ttl: 60 });
      const onDispose = vi.fn();
      cache._addDisposeListener(onDispose);

      await cache.set('key', 'sample');

      expect(onDispose).not.toHaveBeenCalled();

      await cache.delete('key');

      expect(onDispose).toHaveBeenCalledWith('key', 'sample', 'delete');
    });
  });
});

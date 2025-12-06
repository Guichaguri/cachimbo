import { beforeEach, describe, expect, test, vi } from 'vitest';
import { RedisCache } from './index.js';

const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  mGet: vi.fn(),
  mSetEx: vi.fn(),
} as any;

describe('RedisCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    test('returns parsed value for an existing key', async () => {
      const cache = new RedisCache({ client: mockRedisClient });
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ key: 'value' }));

      const result = await cache.get('existing-key');

      expect(result).toEqual({ key: 'value' });
      expect(mockRedisClient.get).toHaveBeenCalledWith('existing-key');
    });

    test('returns null for a non-existing key', async () => {
      const cache = new RedisCache({ client: mockRedisClient });
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await cache.get('non-existing-key');

      expect(result).toBeNull();
      expect(mockRedisClient.get).toHaveBeenCalledWith('non-existing-key');
    });
  });

  describe('set', () => {
    test('stores the value with the specified TTL', async () => {
      const cache = new RedisCache({ client: mockRedisClient });
      const value = { key: 'value' };

      await cache.set('key', value, { ttl: 60 });

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify(value),
        { expiration: { type: 'EX', value: 60 } }
      );
    });

    test('stores the value without TTL when not specified', async () => {
      const cache = new RedisCache({ client: mockRedisClient });
      const value = { key: 'value' };

      await cache.set('key', value);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify(value),
        { expiration: undefined }
      );
    });
  });

  describe('delete', () => {
    test('removes the key from the cache', async () => {
      const cache = new RedisCache({ client: mockRedisClient });

      await cache.delete('key');

      expect(mockRedisClient.del).toHaveBeenCalledWith('key');
    });
  });

  describe('getMany', () => {
    test('returns parsed values for multiple keys', async () => {
      const cache = new RedisCache({ client: mockRedisClient });
      mockRedisClient.mGet.mockResolvedValueOnce([
        JSON.stringify({ key: 'value1' }),
        JSON.stringify({ key: 'value2' }),
        null,
      ]);

      const result = await cache.getMany(['key1', 'key2', 'key3']);

      expect(result).toEqual({
        key1: { key: 'value1' },
        key2: { key: 'value2' },
        key3: null,
      });
      expect(mockRedisClient.mGet).toHaveBeenCalledWith(['key1', 'key2', 'key3']);
    });
  });

  describe('setMany', () => {
    test('uses MSETEX when supported', async () => {
      const cache = new RedisCache({ client: mockRedisClient, isMSETEXSupported: true });
      const data = { key1: 'value1', key2: 'value2' };

      await cache.setMany(data, { ttl: 120 });

      expect(mockRedisClient.mSetEx).toHaveBeenCalledWith(
        [
          ['key1', JSON.stringify('value1')],
          ['key2', JSON.stringify('value2')],
        ],
        { expiration: { type: 'EX', value: 120 } }
      );
    });

    test('uses MSETEX when supported and a ttl is not set', async () => {
      const cache = new RedisCache({ client: mockRedisClient, isMSETEXSupported: true });
      const data = { key1: 'value1', key2: 'value2' };

      await cache.setMany(data);

      expect(mockRedisClient.mSetEx).toHaveBeenCalledWith(
        [
          ['key1', JSON.stringify('value1')],
          ['key2', JSON.stringify('value2')],
        ],
        { expiration: undefined }
      );
    });

    test('falls back to BaseCache setMany when MSETEX is not supported', async () => {
      const cache = new RedisCache({ client: mockRedisClient, isMSETEXSupported: false });
      const data = { key1: 'value1', key2: 'value2' };

      await cache.setMany(data);

      expect(mockRedisClient.mSetEx).not.toHaveBeenCalled();
    });
  });

  describe('deleteMany', () => {
    test('removes multiple keys from the cache', async () => {
      const cache = new RedisCache({ client: mockRedisClient });

      await cache.deleteMany(['key1', 'key2']);

      expect(mockRedisClient.del).toHaveBeenCalledWith(['key1', 'key2']);
    });
  });
});

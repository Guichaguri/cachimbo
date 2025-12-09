import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ValkeyGlideCache } from './index.js';

const mockClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  mget: vi.fn(),
} as any;

describe('ValkeyGlideCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    test('returns parsed value for an existing key', async () => {
      const cache = new ValkeyGlideCache({ client: mockClient });
      mockClient.get.mockResolvedValueOnce(Buffer.from(JSON.stringify({ foo: 'bar' })));

      const result = await cache.get('key');

      expect(result).toEqual({ foo: 'bar' });
      expect(mockClient.get).toHaveBeenCalledWith('key');
    });

    test('returns null for a non-existing key', async () => {
      const cache = new ValkeyGlideCache({ client: mockClient });
      mockClient.get.mockResolvedValueOnce(null);

      const result = await cache.get('key');

      expect(result).toBeNull();
      expect(mockClient.get).toHaveBeenCalledWith('key');
    });
  });

  describe('set', () => {
    test('stores value with default TTL', async () => {
      const cache = new ValkeyGlideCache({ client: mockClient, defaultTTL: 60 });

      await cache.set('key', { foo: 'bar' });

      expect(mockClient.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify({ foo: 'bar' }),
        { expiry: { type: 'EX', count: 60 } },
      );
    });

    test('stores value with custom TTL', async () => {
      const cache = new ValkeyGlideCache({ client: mockClient });

      await cache.set('key', { foo: 'bar' }, { ttl: 120 });

      expect(mockClient.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify({ foo: 'bar' }),
        { expiry: { type: 'EX', count: 120 } },
      );
    });

    test('stores value without TTL when not specified', async () => {
      const cache = new ValkeyGlideCache({ client: mockClient });

      await cache.set('key', { foo: 'bar' });

      expect(mockClient.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify({ foo: 'bar' }),
        { expiry: undefined },
      );
    });
  });

  describe('delete', () => {
    test('removes the key from the cache', async () => {
      const cache = new ValkeyGlideCache({ client: mockClient });

      await cache.delete('key');

      expect(mockClient.del).toHaveBeenCalledWith(['key']);
    });
  });

  describe('getMany', () => {
    test('returns parsed values for multiple keys', async () => {
      const cache = new ValkeyGlideCache({ client: mockClient });
      mockClient.mget.mockResolvedValueOnce([
        Buffer.from(JSON.stringify({ foo: 'bar' })),
        null,
        Buffer.from(JSON.stringify({ baz: 'qux' })),
      ]);

      const result = await cache.getMany(['key1', 'key2', 'key3']);

      expect(result).toEqual({
        key1: { foo: 'bar' },
        key2: null,
        key3: { baz: 'qux' },
      });
      expect(mockClient.mget).toHaveBeenCalledWith(['key1', 'key2', 'key3']);
    });
  });

  describe('deleteMany', () => {
    test('removes multiple keys from the cache', async () => {
      const cache = new ValkeyGlideCache({ client: mockClient });

      await cache.deleteMany(['key1', 'key2']);

      expect(mockClient.del).toHaveBeenCalledWith(['key1', 'key2']);
    });
  });
});

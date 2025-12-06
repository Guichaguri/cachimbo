import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MemcacheCache } from './index.js';

const mockMemcacheClient = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  gets: vi.fn(),
} as any;

describe('MemcacheCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    test('returns parsed value for an existing key', async () => {
      const cache = new MemcacheCache({ client: mockMemcacheClient });
      mockMemcacheClient.get.mockResolvedValueOnce(JSON.stringify({ key: 'value' }));

      const result = await cache.get('existing-key');

      expect(result).toEqual({ key: 'value' });
      expect(mockMemcacheClient.get).toHaveBeenCalledWith('existing-key');
    });

    test('returns null for a non-existing key', async () => {
      const cache = new MemcacheCache({ client: mockMemcacheClient });
      mockMemcacheClient.get.mockResolvedValueOnce(undefined);

      const result = await cache.get('non-existing-key');

      expect(result).toBeNull();
      expect(mockMemcacheClient.get).toHaveBeenCalledWith('non-existing-key');
    });
  });

  describe('set', () => {
    test('stores the value with the specified TTL', async () => {
      const cache = new MemcacheCache({ client: mockMemcacheClient, defaultTTL: 120 });
      const value = { key: 'value' };

      await cache.set('key', value, { ttl: 60 });

      expect(mockMemcacheClient.set).toHaveBeenCalledWith('key', JSON.stringify(value), 60);
    });

    test('stores the value with the default TTL when no TTL is specified', async () => {
      const cache = new MemcacheCache({ client: mockMemcacheClient, defaultTTL: 120 });
      const value = { key: 'value' };

      await cache.set('key', value);

      expect(mockMemcacheClient.set).toHaveBeenCalledWith('key', JSON.stringify(value), 120);
    });

    test('stores the value without TTL when no default TTL is set', async () => {
      const cache = new MemcacheCache({ client: mockMemcacheClient });
      const value = { key: 'value' };

      await cache.set('key', value);

      expect(mockMemcacheClient.set).toHaveBeenCalledWith('key', JSON.stringify(value), undefined);
    });
  });

  describe('delete', () => {
    test('removes the key from the cache', async () => {
      const cache = new MemcacheCache({ client: mockMemcacheClient });

      await cache.delete('key');

      expect(mockMemcacheClient.delete).toHaveBeenCalledWith('key');
    });
  });

  describe('getMany', () => {
    test('returns parsed values for multiple keys', async () => {
      const cache = new MemcacheCache({ client: mockMemcacheClient });
      mockMemcacheClient.gets.mockResolvedValueOnce(new Map([
        ['key1', JSON.stringify({ key: 'value1' })],
        ['key2', JSON.stringify({ key: 'value2' })],
        ['key3', null],
      ]));

      const result = await cache.getMany(['key1', 'key2', 'key3']);

      expect(result).toEqual({
        key1: { key: 'value1' },
        key2: { key: 'value2' },
        key3: null,
      });
      expect(mockMemcacheClient.gets).toHaveBeenCalledWith(['key1', 'key2', 'key3']);
    });
  });
});

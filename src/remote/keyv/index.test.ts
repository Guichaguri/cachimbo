import { beforeEach, describe, expect, test, vi } from 'vitest';
import { KeyvCache } from './index.js';

const mockKeyv = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  getMany: vi.fn(),
  setMany: vi.fn(),
  deleteMany: vi.fn(),
} as any;

describe('KeyvCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    test('returns value for an existing key', async () => {
      const cache = new KeyvCache({ keyv: mockKeyv });
      mockKeyv.get.mockResolvedValueOnce('value');

      const result = await cache.get('existing-key');

      expect(result).toBe('value');
      expect(mockKeyv.get).toHaveBeenCalledWith('existing-key');
    });

    test('returns null for a non-existing key', async () => {
      const cache = new KeyvCache({ keyv: mockKeyv });
      mockKeyv.get.mockResolvedValueOnce(undefined);

      const result = await cache.get('non-existing-key');

      expect(result).toBeNull();
      expect(mockKeyv.get).toHaveBeenCalledWith('non-existing-key');
    });
  });

  describe('set', () => {
    test('stores the value with the specified TTL', async () => {
      const cache = new KeyvCache({ keyv: mockKeyv });

      await cache.set('key', 'value', { ttl: 5000 });

      expect(mockKeyv.set).toHaveBeenCalledWith('key', 'value', 5000);
    });

    test('stores the value without TTL when not specified', async () => {
      const cache = new KeyvCache({ keyv: mockKeyv });

      await cache.set('key', 'value');

      expect(mockKeyv.set).toHaveBeenCalledWith('key', 'value', undefined);
    });
  });

  describe('delete', () => {
    test('removes the key from the cache', async () => {
      const cache = new KeyvCache({ keyv: mockKeyv });

      await cache.delete('key');

      expect(mockKeyv.delete).toHaveBeenCalledWith('key');
    });
  });

  describe('getMany', () => {
    test('returns values for multiple keys', async () => {
      const cache = new KeyvCache({ keyv: mockKeyv });
      mockKeyv.getMany.mockResolvedValueOnce(['value1', undefined, 'value3']);

      const result = await cache.getMany(['key1', 'key2', 'key3']);

      expect(result).toEqual({ key1: 'value1', key2: null, key3: 'value3' });
      expect(mockKeyv.getMany).toHaveBeenCalledWith(['key1', 'key2', 'key3']);
    });
  });

  describe('setMany', () => {
    test('stores multiple values with the specified TTL', async () => {
      const cache = new KeyvCache({ keyv: mockKeyv });
      const data = { key1: 'value1', key2: 'value2' };

      await cache.setMany(data, { ttl: 10000 });

      expect(mockKeyv.setMany).toHaveBeenCalledWith(
        [
          { key: 'key1', value: 'value1', ttl: 10000 },
          { key: 'key2', value: 'value2', ttl: 10000 },
        ],
      );
    });
  });

  describe('deleteMany', () => {
    test('removes multiple keys from the cache', async () => {
      const cache = new KeyvCache({ keyv: mockKeyv });

      await cache.deleteMany(['key1', 'key2']);

      expect(mockKeyv.deleteMany).toHaveBeenCalledWith(['key1', 'key2']);
    });
  });
});

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { RuntimeCache } from '@vercel/functions';
import { VercelRuntimeCache } from './index.js';

const mockRuntimeCache = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  expireTag: vi.fn(),
} satisfies RuntimeCache;

describe('VercelRuntimeCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    test('returns the value for an existing key', async () => {
      const cache = new VercelRuntimeCache({ cache: mockRuntimeCache });
      mockRuntimeCache.get.mockResolvedValueOnce({ key: 'value' });

      const result = await cache.get('existing-key');

      expect(result).toEqual({ key: 'value' });
      expect(mockRuntimeCache.get).toHaveBeenCalledWith('existing-key');
    });

    test('returns undefined for a non-existing key', async () => {
      const cache = new VercelRuntimeCache({ cache: mockRuntimeCache });
      mockRuntimeCache.get.mockResolvedValueOnce(null);

      const result = await cache.get('non-existing-key');

      expect(result).toBeUndefined();
      expect(mockRuntimeCache.get).toHaveBeenCalledWith('non-existing-key');
    });
  });

  describe('set', () => {
    test('stores the value with the specified TTL', async () => {
      const cache = new VercelRuntimeCache({ cache: mockRuntimeCache });
      const value = { key: 'value' };

      await cache.set('key', value, { ttl: 60 });

      expect(mockRuntimeCache.set).toHaveBeenCalledWith('key', value, { ttl: 60 });
    });

    test('stores the value without options when not specified', async () => {
      const cache = new VercelRuntimeCache({ cache: mockRuntimeCache });
      const value = { key: 'value' };

      await cache.set('key', value);

      expect(mockRuntimeCache.set).toHaveBeenCalledWith('key', value, undefined);
    });

    test('forwards the tags and the name to the runtime cache', async () => {
      const cache = new VercelRuntimeCache({ cache: mockRuntimeCache });

      await cache.set('key', 'value', { ttl: 60, tags: ['posts'], name: 'top posts' });

      expect(mockRuntimeCache.set).toHaveBeenCalledWith(
        'key',
        'value',
        { ttl: 60, tags: ['posts'], name: 'top posts' },
      );
    });
  });

  describe('delete', () => {
    test('removes the key from the cache', async () => {
      const cache = new VercelRuntimeCache({ cache: mockRuntimeCache });

      await cache.delete('key');

      expect(mockRuntimeCache.delete).toHaveBeenCalledWith('key');
    });
  });

  describe('invalidateTag', () => {
    test('expires a single tag', async () => {
      const cache = new VercelRuntimeCache({ cache: mockRuntimeCache });

      await cache.invalidateTag('posts');

      expect(mockRuntimeCache.expireTag).toHaveBeenCalledWith('posts');
    });

    test('expires a list of tags', async () => {
      const cache = new VercelRuntimeCache({ cache: mockRuntimeCache });

      await cache.invalidateTags(['posts', 'comments']);

      expect(mockRuntimeCache.expireTag).toHaveBeenCalledWith(['posts', 'comments']);
    });
  });

  describe('getMany', () => {
    test('reads the keys one by one, omitting the ones that do not exist', async () => {
      const cache = new VercelRuntimeCache({ cache: mockRuntimeCache });
      mockRuntimeCache.get
        .mockResolvedValueOnce('value1')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('value3');

      const result = await cache.getMany(['key1', 'key2', 'key3']);

      expect(result).toEqual({ key1: 'value1', key3: 'value3' });
      expect(mockRuntimeCache.get).toHaveBeenCalledTimes(3);
      expect(mockRuntimeCache.get).toHaveBeenCalledWith('key1');
      expect(mockRuntimeCache.get).toHaveBeenCalledWith('key2');
      expect(mockRuntimeCache.get).toHaveBeenCalledWith('key3');
    });
  });

  describe('setMany', () => {
    test('writes the keys one by one', async () => {
      const cache = new VercelRuntimeCache({ cache: mockRuntimeCache });

      await cache.setMany({ key1: 'value1', key2: 'value2' }, { ttl: 60 });

      expect(mockRuntimeCache.set).toHaveBeenCalledTimes(2);
      expect(mockRuntimeCache.set).toHaveBeenCalledWith('key1', 'value1', { ttl: 60 });
      expect(mockRuntimeCache.set).toHaveBeenCalledWith('key2', 'value2', { ttl: 60 });
    });
  });

  describe('deleteMany', () => {
    test('deletes the keys one by one', async () => {
      const cache = new VercelRuntimeCache({ cache: mockRuntimeCache });

      await cache.deleteMany(['key1', 'key2']);

      expect(mockRuntimeCache.delete).toHaveBeenCalledTimes(2);
      expect(mockRuntimeCache.delete).toHaveBeenCalledWith('key1');
      expect(mockRuntimeCache.delete).toHaveBeenCalledWith('key2');
    });
  });
});

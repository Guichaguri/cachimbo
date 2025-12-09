import { beforeEach, describe, expect, test, vi } from 'vitest';
import { JitteringCache } from './index.js';
import type { ICache } from '../../types/cache.js';

const mockCache = {
  get: vi.fn(),
  getOrLoad: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  getMany: vi.fn(),
  setMany: vi.fn(),
  deleteMany: vi.fn(),
} satisfies ICache;

const random = vi.spyOn(Math, 'random');

describe('JitterCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    test('retrieves value for a key', async () => {
      mockCache.get.mockResolvedValueOnce('value');
      const jitterCache = new JitteringCache({ cache: mockCache, defaultTTL: 60, maxJitterTTL: 10 });

      const result = await jitterCache.get('key');

      expect(result).toBe('value');
      expect(mockCache.get).toHaveBeenCalledWith('key');
    });
  });

  describe('getOrLoad', () => {
    test('loads value if not present and sets it with jittered TTL', async () => {
      const jitterCache = new JitteringCache({ cache: mockCache, defaultTTL: 60, maxJitterTTL: 10 });
      const load = vi.fn().mockResolvedValue('loadedValue');
      mockCache.getOrLoad.mockResolvedValueOnce('loadedValue');
      random.mockReturnValueOnce(0.5); // To control jitter

      const result = await jitterCache.getOrLoad('key', load);

      expect(result).toBe('loadedValue');
      expect(mockCache.getOrLoad).toHaveBeenCalledWith('key', load, { ttl: 65 });
    });
  });

  describe('set', () => {
    test('sets a value with jittered TTL', async () => {
      const jitterCache = new JitteringCache({ cache: mockCache, defaultTTL: 60, maxJitterTTL: 10 });
      random.mockReturnValueOnce(0.1); // To control jitter

      await jitterCache.set('key', 'value');

      expect(mockCache.set).toHaveBeenCalledWith('key', 'value', { ttl: 61 });
    });
  });

  describe('delete', () => {
    test('deletes a key', async () => {
      const jitterCache = new JitteringCache({ cache: mockCache, defaultTTL: 60, maxJitterTTL: 10 });

      await jitterCache.delete('key');

      expect(mockCache.delete).toHaveBeenCalledWith('key');
    });
  });

  describe('getMany', () => {
    test('retrieves multiple values for keys', async () => {
      const jitterCache = new JitteringCache({ cache: mockCache, defaultTTL: 60, maxJitterTTL: 10 });
      mockCache.getMany.mockResolvedValueOnce({ key1: 'value1', key2: null });

      const result = await jitterCache.getMany(['key1', 'key2']);

      expect(result).toEqual({ key1: 'value1', key2: null });
      expect(mockCache.getMany).toHaveBeenCalledWith(['key1', 'key2']);
    });
  });

  describe('setMany', () => {
    test('sets multiple values with jittered TTL', async () => {
      const jitterCache = new JitteringCache({ cache: mockCache, defaultTTL: 60, maxJitterTTL: 10 });
      const data = { key1: 'value1', key2: 'value2' };
      random.mockReturnValueOnce(1.0); // To control jitter

      await jitterCache.setMany(data);

      expect(mockCache.setMany).toHaveBeenCalledWith(data, { ttl: 70 });
    });

    test('sets multiple values with jittered and custom TTL', async () => {
      const jitterCache = new JitteringCache({ cache: mockCache, defaultTTL: 60, maxJitterTTL: 10 });
      const data = { key1: 'value1', key2: 'value2' };
      random.mockReturnValueOnce(1.0); // To control jitter

      await jitterCache.setMany(data, { ttl: 120 });

      expect(mockCache.setMany).toHaveBeenCalledWith(data, { ttl: 130 });
    });
  });

  describe('deleteMany', () => {
    test('deletes multiple keys', async () => {
      const jitterCache = new JitteringCache({ cache: mockCache, defaultTTL: 60, maxJitterTTL: 10 });

      await jitterCache.deleteMany(['key1', 'key2']);

      expect(mockCache.deleteMany).toHaveBeenCalledWith(['key1', 'key2']);
    });
  });
});

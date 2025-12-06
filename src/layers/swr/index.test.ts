import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ICache } from '../../types/cache.js';
import { SWRCache } from './index.js';

const mockedCache = {
  get: vi.fn().mockReturnValue(null),
  set: vi.fn(),
  delete: vi.fn(),
  getOrLoad: vi.fn((_, load) => load()),
  getMany: vi.fn().mockReturnValue({}),
  setMany: vi.fn(),
  deleteMany: vi.fn(),
} satisfies ICache;

const swrCache = new SWRCache({
  cache: mockedCache,
  defaultTTL: 240,
  staleTTL: 60,
});

const dateNow = vi.spyOn(Date, 'now');

const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SWR Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    test('should return null when cache miss', async () => {
      mockedCache.get.mockResolvedValueOnce({ data: 'value' });

      const result = await swrCache.get('key1');

      expect(result).toBe('value');
      expect(mockedCache.get).toHaveBeenCalledWith('key1');
    });

    test('should return null when cache miss', async () => {
      mockedCache.get.mockResolvedValueOnce(null);

      const result = await swrCache.get('key1');

      expect(result).toBeNull();
      expect(mockedCache.get).toHaveBeenCalledWith('key1');
    });
  });

  describe('getOrLoad', () => {
    test('should load from source when cache miss', async () => {
      const load = vi.fn().mockResolvedValue('value');

      const result = await swrCache.getOrLoad('key1', load, { ttl: 120 });

      expect(result).toBe('value');
      expect(mockedCache.getOrLoad).toHaveBeenCalledWith('key1', expect.any(Function), { ttl: 120 + 60 });
      expect(load).toHaveBeenCalled();
    });

    test('should load from source and return when cache is stale', async () => {
      dateNow.mockReturnValue(5000);
      mockedCache.getOrLoad.mockResolvedValueOnce({ data: 'value', expiresAt: 1000 });
      const load = vi.fn().mockResolvedValue('fresh-value');

      const result = await swrCache.getOrLoad('key1', load);

      await waitFor(1); // Wait for async set

      expect(result).toBe('value');
      expect(mockedCache.getOrLoad).toHaveBeenCalledWith('key1', expect.any(Function), { ttl: 240 + 60 });
      expect(load).toHaveBeenCalled();
      expect(mockedCache.set).toHaveBeenCalledWith(
        'key1',
        { data: 'fresh-value', expiresAt: 5000 + 240_000 },
        { ttl: 240 + 60 },
      );
    });

    test('should not revalidate if there is an ongoing revalidation', async () => {
      dateNow.mockReturnValue(5000);
      mockedCache.getOrLoad.mockResolvedValue({ data: 'value', expiresAt: 1000 });
      const load = vi.fn(() => waitFor(5).then(() => 'fresh-value'));
      const load2 = vi.fn().mockResolvedValue('another-fresh-value');

      const [res1, res2, res3] = await Promise.all([
        swrCache.getOrLoad('key1', load),
        swrCache.getOrLoad('key1', load),
        swrCache.getOrLoad('key2', load2),
      ]);

      await waitFor(10); // Wait for async set

      expect(res1).toBe('value');
      expect(res2).toBe('value');
      expect(res3).toBe('value');
      expect(mockedCache.getOrLoad).toHaveBeenCalledTimes(3);
      expect(mockedCache.getOrLoad).toHaveBeenCalledWith('key1', expect.any(Function), { ttl: 240 + 60 });
      expect(mockedCache.getOrLoad).toHaveBeenCalledWith('key2', expect.any(Function), { ttl: 240 + 60 });
      expect(load).toHaveBeenCalledTimes(1);
      expect(load2).toHaveBeenCalledTimes(1);
      expect(mockedCache.set).toHaveBeenCalledTimes(2);
      expect(mockedCache.set).toHaveBeenCalledWith(
        'key1',
        { data: 'fresh-value', expiresAt: 5000 + 240_000 },
        { ttl: 240 + 60 },
      );
      expect(mockedCache.set).toHaveBeenCalledWith(
        'key2',
        { data: 'another-fresh-value', expiresAt: 5000 + 240_000 },
        { ttl: 240 + 60 },
      );
    });
  });

  describe('set', () => {
    test('should set value in cache', async () => {
      dateNow.mockReturnValue(3000);

      await swrCache.set('key1', 'value1', { ttl: 100 });

      expect(mockedCache.set).toHaveBeenCalledWith(
        'key1',
        { data: 'value1' , expiresAt: 3000 + 100_000 },
        { ttl: 100 + 60 },
      );
    });

    test('should set value in cache with the default options', async () => {
      dateNow.mockReturnValue(5000);

      await swrCache.set('key', 'value');

      expect(mockedCache.set).toHaveBeenCalledWith(
        'key',
        { data: 'value' , expiresAt: 5000 + 240_000 },
        { ttl: 240 + 60 },
      );
    });
  });

  describe('delete', () => {
    test('should delete value from cache', async () => {
      await swrCache.delete('key1');

      expect(mockedCache.delete).toHaveBeenCalledWith('key1');
    });
  });

  describe('getMany', () => {
    test('should get many values from cache', async () => {
      mockedCache.getMany.mockResolvedValueOnce({
        key1: { data: 'value1' },
        key2: { data: 'value2' },
        key3: null,
      });

      const result = await swrCache.getMany(['key1', 'key2', 'key3']);

      expect(result).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: null,
      });
      expect(mockedCache.getMany).toHaveBeenCalledWith(['key1', 'key2', 'key3']);
    });
  });

  describe('setMany', () => {
    test('should set many values in cache', async () => {
      dateNow.mockReturnValue(3000);
      const entries = {
        key1: 'value1',
        key2: 'value2',
      };

      await swrCache.setMany(entries, { ttl: 150 });

      expect(mockedCache.setMany).toHaveBeenCalledWith(
        {
          key1: { data: 'value1', expiresAt: 3000 + 150_000 },
          key2: { data: 'value2', expiresAt: 3000 + 150_000 },
        },
        { ttl: 150 + 60 },
      );
    });

    test('should set many values in cache with default options', async () => {
      dateNow.mockReturnValue(4000);
      const entries = {
        key1: 'value1',
        key2: 'value2',
      };

      await swrCache.setMany(entries);

      expect(mockedCache.setMany).toHaveBeenCalledWith(
        {
          key1: { data: 'value1', expiresAt: 4000 + 240_000 },
          key2: { data: 'value2', expiresAt: 4000 + 240_000 },
        },
        { ttl: 240 + 60 },
      );
    });
  });

  describe('deleteMany', () => {
    test('should delete many values from cache', async () => {
      await swrCache.deleteMany(['key1', 'key2']);

      expect(mockedCache.deleteMany).toHaveBeenCalledWith(['key1', 'key2']);
    });
  });

});

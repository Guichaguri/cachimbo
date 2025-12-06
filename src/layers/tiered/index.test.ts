import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ICache } from '../../types/cache.js';
import { type CacheTier, TieredCache } from './index.js';

const createMockCacheLayer = () => ({
  get: vi.fn().mockReturnValue(null),
  set: vi.fn(),
  delete: vi.fn(),
  getOrLoad: vi.fn((_, load) => load()),
  getMany: vi.fn().mockReturnValue({}),
  setMany: vi.fn(),
  deleteMany: vi.fn(),
} satisfies ICache);

const localCache = createMockCacheLayer();
const remoteCache = createMockCacheLayer();

const tiers: CacheTier[] = [
  {
    cache: localCache,
    options: { ttl: 30 },
  },
  {
    cache: remoteCache,
  }
];

const tieredCache = new TieredCache({ tiers });

describe('Tiered Cache', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    test('should return value from the first tier that has it', async () => {
      const key = 'test-key';
      const value = 'test-value';

      localCache.getOrLoad.mockResolvedValueOnce(value);

      const result = await tieredCache.get<string>(key);

      expect(result).toBe(value);
      expect(localCache.getOrLoad).toHaveBeenCalledWith(key, expect.any(Function), { ttl: 30 });
      expect(remoteCache.get).not.toHaveBeenCalled();
    });

    test('should return value from the final tier if others are missing', async () => {
      const key = 'test-key';
      const value = 'test-value';

      remoteCache.get.mockResolvedValueOnce(value);

      const result = await tieredCache.get<string>(key);

      expect(result).toBe(value);
      expect(localCache.getOrLoad).toHaveBeenCalledWith(key, expect.any(Function), { ttl: 30 });
      expect(remoteCache.get).toHaveBeenCalledWith(key);
    });

    test('should return null if no tier has the value', async () => {
      const key = 'missing-key';

      remoteCache.get.mockResolvedValueOnce(null);

      const result = await tieredCache.get<string>(key);

      expect(result).toBeNull();
      expect(localCache.getOrLoad).toHaveBeenCalledWith(key, expect.any(Function), { ttl: 30 });
      expect(remoteCache.get).toHaveBeenCalledWith(key);
    });
  });

  describe('getOrLoad', () => {
    test('should return value from the final tier if others are missing', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const load = vi.fn().mockResolvedValue('nope');

      remoteCache.getOrLoad.mockResolvedValueOnce(value);

      const result = await tieredCache.getOrLoad<string>(key, load);

      expect(result).toBe(value);
      expect(localCache.getOrLoad).toHaveBeenCalledWith(key, expect.any(Function), { ttl: 30 });
      expect(remoteCache.getOrLoad).toHaveBeenCalledWith(key, load, undefined);
      expect(load).not.toHaveBeenCalled();
    });

    test('should load from source if all tiers are missing', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const load = vi.fn().mockResolvedValue(value);

      const result = await tieredCache.getOrLoad<string>(key, load, { ttl: 120 });

      expect(result).toBe(value);
      expect(localCache.getOrLoad).toHaveBeenCalledWith(key, expect.any(Function), { ttl: 30 });
      expect(remoteCache.getOrLoad).toHaveBeenCalledWith(key, load, { ttl: 120 });
      expect(load).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    test('should set value in all tiers', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await tieredCache.set<string>(key, value, { ttl: 120 });

      expect(localCache.set).toHaveBeenCalledWith(key, value, { ttl: 30 });
      expect(remoteCache.set).toHaveBeenCalledWith(key, value, { ttl: 120 });
    });

    test('should set value in all tiers with default options', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await tieredCache.set<string>(key, value);

      expect(localCache.set).toHaveBeenCalledWith(key, value, { ttl: 30 });
      expect(remoteCache.set).toHaveBeenCalledWith(key, value, undefined);
    });
  });

  describe('delete', () => {
    test('should delete value from all tiers', async () => {
      const key = 'test-key';

      await tieredCache.delete(key);

      expect(localCache.delete).toHaveBeenCalledWith(key);
      expect(remoteCache.delete).toHaveBeenCalledWith(key);
    });
  });

  describe('getMany', () => {
    test('should get values from mixed tiers', async () => {
      const firstTierResult = { key1: 'value1', key2: null, key3: null };
      const secondTierResult = { key2: null, key3: 'value3' };

      localCache.getMany.mockResolvedValueOnce(firstTierResult);
      remoteCache.getMany.mockResolvedValueOnce(secondTierResult);

      const keys = ['key1', 'key2', 'key3'];
      const result = await tieredCache.getMany<string>(keys);

      expect(result).toEqual({ key1: 'value1', key2: null, key3: 'value3' });
      expect(localCache.getMany).toHaveBeenCalledWith(keys);
      expect(remoteCache.getMany).toHaveBeenCalledWith(['key2', 'key3']);
      expect(localCache.setMany).toHaveBeenCalledWith({ key3: 'value3' }, { ttl: 30 });
      expect(remoteCache.setMany).not.toHaveBeenCalled();
    });

    test('should not call next tiers if it returned all keys', async () => {
      const firstTierResult = { key1: 'value1', key2: 'val2', key3: 'val3' };

      localCache.getMany.mockResolvedValueOnce(firstTierResult);

      const keys = ['key1', 'key2', 'key3'];
      const result = await tieredCache.getMany<string>(keys);

      expect(result).toEqual(firstTierResult);
      expect(localCache.getMany).toHaveBeenCalledWith(keys);
      expect(remoteCache.getMany).not.toHaveBeenCalled();
      expect(localCache.setMany).not.toHaveBeenCalled();
      expect(remoteCache.setMany).not.toHaveBeenCalled();
    });

    test('should not backfill if no tiers have the values', async () => {
      const tierResult = { key1: null, key2: null, key3: null };

      localCache.getMany.mockResolvedValueOnce(tierResult);
      remoteCache.getMany.mockResolvedValueOnce(tierResult);

      const keys = ['key1', 'key2', 'key3'];
      const result = await tieredCache.getMany<string>(keys);

      expect(result).toEqual(tierResult);
      expect(localCache.getMany).toHaveBeenCalledWith(keys);
      expect(remoteCache.getMany).toHaveBeenCalledWith(keys);
      expect(localCache.setMany).not.toHaveBeenCalled();
      expect(remoteCache.setMany).not.toHaveBeenCalled();
    });
  });

  describe('setMany', () => {
    test('should set values in all tiers', async () => {
      const values = { key1: 'value1', key2: 'value2' };

      await tieredCache.setMany<string>(values, { ttl: 120 });

      expect(localCache.setMany).toHaveBeenCalledWith(values, { ttl: 30 });
      expect(remoteCache.setMany).toHaveBeenCalledWith(values, { ttl: 120 });
    });

    test('should set values in all tiers with the default options', async () => {
      const values = { key1: 'value1', key2: 'value2' };

      await tieredCache.setMany<string>(values);

      expect(localCache.setMany).toHaveBeenCalledWith(values, { ttl: 30 });
      expect(remoteCache.setMany).toHaveBeenCalledWith(values, undefined);
    });
  });

  describe('deleteMany', () => {
    test('should delete values from all tiers', async () => {
      const keys = ['key1', 'key2', 'key3'];

      await tieredCache.deleteMany(keys);

      expect(localCache.deleteMany).toHaveBeenCalledWith(keys);
      expect(remoteCache.deleteMany).toHaveBeenCalledWith(keys);
    });
  });

});

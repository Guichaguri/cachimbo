import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AsyncLazyCache } from './index.js';
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

const mockFactory = vi.fn(() => mockCache);

describe('AsyncCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('initializes cache eagerly when lazy is false', async () => {
      new AsyncLazyCache({ factory: mockFactory, lazy: false });

      expect(mockFactory).toHaveBeenCalledTimes(1);
    });

    test('initializes cache lazily when lazy is true', async () => {
      const cache = new AsyncLazyCache({ factory: mockFactory, lazy: true });

      expect(mockFactory).not.toHaveBeenCalled();

      await cache.get('key');

      expect(mockFactory).toHaveBeenCalledTimes(1);
    });
  });

  describe('get', () => {
    test('retrieves value for a key', async () => {
      const cache = new AsyncLazyCache({ factory: mockFactory });
      mockCache.get.mockResolvedValueOnce('value');

      const result = await cache.get('key');

      expect(result).toBe('value');
      expect(mockCache.get).toHaveBeenCalledWith('key');
    });

    test('only initialize cache once in sequential gets', async () => {
      const cache = new AsyncLazyCache({ factory: mockFactory });
      mockCache.get.mockResolvedValue('value');

      const result1 = await cache.get('key');
      const result2 = await cache.get('key');

      expect(result1).toBe('value');
      expect(result2).toBe('value');
      expect(mockCache.get).toHaveBeenCalledWith('key');
      expect(mockFactory).toHaveBeenCalledTimes(1);
    });

    test('only initialize cache once in parallel gets', async () => {
      const cache = new AsyncLazyCache({ factory: mockFactory });
      mockCache.get.mockResolvedValue('value');

      const [result1, result2] = await Promise.all([
        cache.get('key'),
        cache.get('key'),
      ]);

      expect(result1).toBe('value');
      expect(result2).toBe('value');
      expect(mockCache.get).toHaveBeenCalledWith('key');
      expect(mockFactory).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOrLoad', () => {
    test('loads value if not present and sets it', async () => {
      const cache = new AsyncLazyCache({ factory: mockFactory });
      const loadFn = vi.fn().mockResolvedValue('loadedValue');
      mockCache.getOrLoad.mockResolvedValueOnce('loadedValue');

      const result = await cache.getOrLoad('key', loadFn);

      expect(result).toBe('loadedValue');
      expect(mockCache.getOrLoad).toHaveBeenCalledWith('key', loadFn, undefined);
    });
  });

  describe('set', () => {
    test('sets a value for a key', async () => {
      const cache = new AsyncLazyCache({ factory: mockFactory });

      await cache.set('key', 'value');

      expect(mockCache.set).toHaveBeenCalledWith('key', 'value', undefined);
    });
  });

  describe('delete', () => {
    test('deletes a key', async () => {
      const cache = new AsyncLazyCache({ factory: mockFactory });

      await cache.delete('key');

      expect(mockCache.delete).toHaveBeenCalledWith('key');
    });
  });

  describe('getMany', () => {
    test('retrieves multiple values for keys', async () => {
      const cache = new AsyncLazyCache({ factory: mockFactory });
      mockCache.getMany.mockResolvedValueOnce({ key1: 'value1', key2: null });

      const result = await cache.getMany(['key1', 'key2']);

      expect(result).toEqual({ key1: 'value1', key2: null });
      expect(mockCache.getMany).toHaveBeenCalledWith(['key1', 'key2']);
    });
  });

  describe('setMany', () => {
    test('sets multiple values', async () => {
      const cache = new AsyncLazyCache({ factory: mockFactory });
      const data = { key1: 'value1', key2: 'value2' };

      await cache.setMany(data);

      expect(mockCache.setMany).toHaveBeenCalledWith(data, undefined);
    });
  });

  describe('deleteMany', () => {
    test('deletes multiple keys', async () => {
      const cache = new AsyncLazyCache({ factory: mockFactory });

      await cache.deleteMany(['key1', 'key2']);

      expect(mockCache.deleteMany).toHaveBeenCalledWith(['key1', 'key2']);
    });
  });
});

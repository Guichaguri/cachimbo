import { beforeEach, describe, expect, test, vi } from 'vitest';
import { KeyTransformingCache } from './index.js';

const mockCache = {
  get: vi.fn(),
  getOrLoad: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  getMany: vi.fn(),
  setMany: vi.fn(),
  deleteMany: vi.fn(),
};

describe('KeyTransformingCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('creates instance with prefix and suffix', () => {
      expect(() => new KeyTransformingCache({
        cache: mockCache,
        prefix: 'prefix:',
        suffix: ':suffix',
      })).not.toThrow();
    });

    test('creates instance with custom transform function', () => {
      expect(() => new KeyTransformingCache({
        cache: mockCache,
        transform: key => key.toUpperCase(),
      })).not.toThrow();
    });
  });

  describe('get', () => {
    test('returns value for transformed key', async () => {
      const cache = new KeyTransformingCache({ cache: mockCache, prefix: 'prefix-' });
      mockCache.get.mockResolvedValueOnce('value');

      const result = await cache.get('key');

      expect(result).toBe('value');
      expect(mockCache.get).toHaveBeenCalledWith('prefix-key');
    });
  });

  describe('getOrLoad', () => {
    test('loads value for transformed key when not found', async () => {
      const cache = new KeyTransformingCache({ cache: mockCache, suffix: '-suffix' });
      const load = vi.fn().mockResolvedValue('loaded-value');
      mockCache.getOrLoad.mockResolvedValueOnce('loaded-value');

      const result = await cache.getOrLoad('key', load);

      expect(result).toBe('loaded-value');
      expect(mockCache.getOrLoad).toHaveBeenCalledWith('key-suffix', load, undefined);
    });
  });

  describe('set', () => {
    test('stores value with transformed key', async () => {
      const cache = new KeyTransformingCache({ cache: mockCache, prefix: 'prefix-', suffix: '-suffix' });

      await cache.set('key', 'value');

      expect(mockCache.set).toHaveBeenCalledWith('prefix-key-suffix', 'value', undefined);
    });
  });

  describe('delete', () => {
    test('deletes value with transformed key', async () => {
      const cache = new KeyTransformingCache({ cache: mockCache, prefix: 'prefix-' });

      await cache.delete('key');

      expect(mockCache.delete).toHaveBeenCalledWith('prefix-key');
    });
  });

  describe('getMany', () => {
    test('returns values for transformed keys', async () => {
      const cache = new KeyTransformingCache({ cache: mockCache, suffix: '-suffix' });
      mockCache.getMany.mockResolvedValueOnce({ 'key1-suffix': 'value1', 'key2-suffix': null });

      const result = await cache.getMany(['key1', 'key2']);

      expect(result).toEqual({ key1: 'value1', key2: null });
      expect(mockCache.getMany).toHaveBeenCalledWith(['key1-suffix', 'key2-suffix']);
    });
  });

  describe('setMany', () => {
    test('stores values with transformed keys', async () => {
      const cache = new KeyTransformingCache({ cache: mockCache, prefix: 'prefix-' });
      const data = { key1: 'value1', key2: 'value2' };

      await cache.setMany(data);

      expect(mockCache.setMany).toHaveBeenCalledWith(
        { 'prefix-key1': 'value1', 'prefix-key2': 'value2' },
        undefined,
      );
    });
  });

  describe('deleteMany', () => {
    test('deletes values with transformed keys', async () => {
      const cache = new KeyTransformingCache({ cache: mockCache, suffix: '-suffix' });

      await cache.deleteMany(['key1', 'key2']);

      expect(mockCache.deleteMany).toHaveBeenCalledWith(['key1-suffix', 'key2-suffix']);
    });
  });
});

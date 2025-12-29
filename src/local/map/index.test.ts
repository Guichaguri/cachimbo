import { describe, expect, test, vi } from 'vitest';
import { LocalMapCache } from './index.js';

const mockMap = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  has: vi.fn(),
  keys: vi.fn(() => new Map([['key', 'value']]).keys()),
  size: 0,
  clear: vi.fn(),
};

describe('LocalMapCache', () => {
  describe('constructor', () => {
    test('initializes with provided Map instance', () => {
      expect(() => new LocalMapCache({ map: mockMap })).not.toThrow();
    });

    test('initializes with default Map instance when none provided', () => {
      expect(() => new LocalMapCache()).not.toThrow();
    });
  });

  describe('get', () => {
    test('returns the value for an existing key', async () => {
      const cache = new LocalMapCache({ map: mockMap });
      mockMap.get.mockReturnValueOnce('value');

      const result = await cache.get('existing-key');

      expect(result).toBe('value');
      expect(mockMap.get).toHaveBeenCalledWith('existing-key');
    });

    test('returns null for a non-existing key', async () => {
      const cache = new LocalMapCache({ map: mockMap });
      mockMap.get.mockReturnValueOnce(undefined);

      const result = await cache.get('non-existing-key');

      expect(result).toBeNull();
      expect(mockMap.get).toHaveBeenCalledWith('non-existing-key');
    });
  });

  describe('set', () => {
    test('stores the value when the cache is not full', async () => {
      const cache = new LocalMapCache({ map: mockMap, max: 2 });
      mockMap.size = 1;
      mockMap.has.mockReturnValueOnce(false);

      await cache.set('key', 'value');

      expect(mockMap.set).toHaveBeenCalledWith('key', 'value');
    });

    test('evicts the oldest key when the cache is full', async () => {
      const cache = new LocalMapCache({ map: mockMap, max: 1 });
      mockMap.size = 1;
      mockMap.has.mockReturnValueOnce(false);
      mockMap.keys.mockReturnValueOnce(['old-key'][Symbol.iterator]());

      await cache.set('new-key', 'new-value');

      expect(mockMap.delete).toHaveBeenCalledWith('old-key');
      expect(mockMap.set).toHaveBeenCalledWith('new-key', 'new-value');
    });
  });

  describe('delete', () => {
    test('removes the key from the cache', async () => {
      const cache = new LocalMapCache({ map: mockMap });

      await cache.delete('key');

      expect(mockMap.delete).toHaveBeenCalledWith('key');
    });

    test('calls dispose when deleting', async () => {
      const cache = new LocalMapCache();
      const onDispose = vi.fn();
      cache.internal._addDisposeListener(onDispose);

      await cache.set('key', 'sample');

      expect(onDispose).not.toHaveBeenCalled();

      await cache.delete('key');

      expect(onDispose).toHaveBeenCalledWith('key', 'sample', 'delete');
    });
  });

  describe('setMany', () => {
    test('stores multiple values when the cache has enough space', async () => {
      const cache = new LocalMapCache({ map: mockMap, max: 5 });
      mockMap.size = 2;
      mockMap.has.mockReturnValue(false);

      await cache.setMany({ key1: 'value1', key2: 'value2' });

      expect(mockMap.set).toHaveBeenCalledWith('key1', 'value1');
      expect(mockMap.set).toHaveBeenCalledWith('key2', 'value2');
    });

    test('evicts the oldest keys when the cache is full', async () => {
      const cache = new LocalMapCache({ map: mockMap, max: 3 });
      mockMap.size = 3;
      mockMap.has.mockReturnValue(false);
      mockMap.keys.mockReturnValueOnce(['old-key1', 'old-key2'][Symbol.iterator]());

      await cache.setMany({ key1: 'value1', key2: 'value2', key3: 'value3' });

      expect(mockMap.delete).toHaveBeenCalledWith('old-key1');
      expect(mockMap.delete).toHaveBeenCalledWith('old-key2');
      expect(mockMap.set).toHaveBeenCalledWith('key1', 'value1');
      expect(mockMap.set).toHaveBeenCalledWith('key2', 'value2');
      expect(mockMap.set).toHaveBeenCalledWith('key3', 'value3');
    });
  });

  describe('clear', () => {
    test('removes all keys from the cache', () => {
      const cache = new LocalMapCache({ map: mockMap });

      cache.clear();

      expect(mockMap.clear).toHaveBeenCalled();
    });
  });
});

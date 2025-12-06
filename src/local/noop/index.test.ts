import { describe, expect, test, vi } from 'vitest';
import { NoOpCache } from './index.js';

describe('NoOpCache', () => {
  describe('get', () => {
    test('returns null for any key', async () => {
      const cache = new NoOpCache();
      const result = await cache.get('any-key');
      expect(result).toBeNull();
    });
  });

  describe('getMany', () => {
    test('returns an empty object for any keys', async () => {
      const cache = new NoOpCache();
      const result = await cache.getMany(['key1', 'key2']);
      expect(result).toEqual({});
    });
  });

  describe('getOrLoad', () => {
    test('calls load function and returns its result', async () => {
      const cache = new NoOpCache();
      const load = vi.fn().mockResolvedValue('loaded-value');
      const result = await cache.getOrLoad('key', load);
      expect(result).toBe('loaded-value');
      expect(load).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    test('does not throw when setting a value', async () => {
      const cache = new NoOpCache();
      await expect(cache.set('key', 'value')).resolves.not.toThrow();
    });
  });

  describe('setMany', () => {
    test('does not throw when setting multiple values', async () => {
      const cache = new NoOpCache();
      await expect(cache.setMany({ key1: 'value1', key2: 'value2' })).resolves.not.toThrow();
    });
  });

  describe('delete', () => {
    test('does not throw when deleting a key', async () => {
      const cache = new NoOpCache();
      await expect(cache.delete('key')).resolves.not.toThrow();
    });
  });

  describe('deleteMany', () => {
    test('does not throw when deleting multiple keys', async () => {
      const cache = new NoOpCache();
      await expect(cache.deleteMany(['key1', 'key2'])).resolves.not.toThrow();
    });
  });
});

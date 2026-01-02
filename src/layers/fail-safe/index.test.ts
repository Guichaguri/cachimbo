import type { ICache } from '../../types/cache.js';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { FailSafeCache } from './index.js';

const cacheMock = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn(),
  delete: vi.fn(),
  getMany: vi.fn().mockResolvedValue({}),
  setMany: vi.fn(),
  deleteMany: vi.fn(),
  getOrLoad: async (key, load, options) => {
    await cacheMock.get(key);
    const value = await load();
    await cacheMock.set(key, value, options);
    return value;
  },
} satisfies ICache;

describe('FailSafeCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('should construct with a custom onError function', async () => {
      const onError = vi.fn();
      const cache = new FailSafeCache({
        cache: cacheMock,
        onError: onError,
      });

      const error = new Error();

      cacheMock.get.mockRejectedValueOnce(error);

      await expect(cache.get('sample')).resolves.toBeNull();

      expect(cacheMock.get).toHaveBeenCalledWith('sample');
      expect(onError).toHaveBeenCalledWith('get', error);
    });

    test('should construct with default options', async () => {
      const cache = new FailSafeCache({
        cache: cacheMock,
      });

      cacheMock.get.mockRejectedValueOnce(new Error());

      await expect(cache.get('sample')).resolves.toBeNull();

      expect(cacheMock.get).toHaveBeenCalledWith('sample');
    });
  });

  describe('get', () => {
    test('should resolve on fail-open errors', async () => {
      const cache = new FailSafeCache({
        cache: cacheMock,
        policy: { get: 'fail-open' },
      });

      cacheMock.get.mockRejectedValueOnce(new Error());

      await expect(cache.get('sample')).resolves.toBeNull();

      expect(cacheMock.get).toHaveBeenCalledWith('sample');
    });

    test('should throw on fail-closed errors', async () => {
      const cache = new FailSafeCache({
        cache: cacheMock,
        policy: { get: 'fail-closed' },
      });

      cacheMock.get.mockRejectedValueOnce(new Error());

      await expect(cache.get('sample')).rejects.throws(Error);

      expect(cacheMock.get).toHaveBeenCalledWith('sample');
    });
  });

  describe('set', () => {
    test('should resolve on fail-open errors', async () => {
      const cache = new FailSafeCache({
        cache: cacheMock,
        policy: { set: 'fail-open' },
      });

      cacheMock.set.mockRejectedValueOnce(new Error());

      await expect(cache.set('sample', 'value')).resolves.toBeUndefined();

      expect(cacheMock.set).toHaveBeenCalledWith('sample', 'value', undefined);
    });

    test('should throw on fail-closed errors', async () => {
      const cache = new FailSafeCache({
        cache: cacheMock,
        policy: { set: 'fail-closed' },
      });

      cacheMock.set.mockRejectedValueOnce(new Error());

      await expect(cache.set('sample', 'value')).rejects.throws(Error);

      expect(cacheMock.set).toHaveBeenCalledWith('sample', 'value', undefined);
    });
  });

  describe('delete', () => {
    test('should resolve on fail-open errors', async () => {
      const cache = new FailSafeCache({
        cache: cacheMock,
        policy: { delete: 'fail-open' },
      });

      cacheMock.delete.mockRejectedValueOnce(new Error());

      await expect(cache.delete('sample')).resolves.toBeUndefined();

      expect(cacheMock.delete).toHaveBeenCalledWith('sample');
    });

    test('should throw on fail-closed errors', async () => {
      const cache = new FailSafeCache({
        cache: cacheMock,
        policy: { delete: 'fail-closed' },
      });

      cacheMock.delete.mockRejectedValueOnce(new Error());

      await expect(cache.delete('sample')).rejects.throws(Error);

      expect(cacheMock.delete).toHaveBeenCalledWith('sample');
    });
  });

  describe('getMany', () => {
    test('should resolve on fail-open errors', async () => {
      const cache = new FailSafeCache({
        cache: cacheMock,
        policy: { get: 'fail-open' },
      });

      cacheMock.getMany.mockRejectedValueOnce(new Error());

      await expect(cache.getMany(['sample'])).resolves.toEqual({});

      expect(cacheMock.getMany).toHaveBeenCalledWith(['sample']);
    });
  });

  describe('setMany', () => {
    test('should resolve on fail-open errors', async () => {
      const cache = new FailSafeCache({
        cache: cacheMock,
        policy: { set: 'fail-open' },
      });

      cacheMock.setMany.mockRejectedValueOnce(new Error());

      await expect(cache.setMany({ sample: 'value' })).resolves.toBeUndefined();

      expect(cacheMock.setMany).toHaveBeenCalledWith({ sample: 'value' }, undefined);
    });
  });

  describe('deleteMany', () => {
    test('should resolve on fail-open errors', async () => {
      const cache = new FailSafeCache({
        cache: cacheMock,
        policy: { delete: 'fail-open' },
      });

      cacheMock.deleteMany.mockRejectedValueOnce(new Error());

      await expect(cache.deleteMany(['sample'])).resolves.toBeUndefined();

      expect(cacheMock.deleteMany).toHaveBeenCalledWith(['sample']);
    });
  });

  describe('getOrLoad', () => {
    test('should handle get errors', async () => {
      const cache = new FailSafeCache({
        cache: cacheMock,
        policy: { getOrLoad: 'fail-open' },
      });
      const load = vi.fn().mockResolvedValue('success');

      cacheMock.get.mockRejectedValueOnce(new Error());

      await expect(cache.getOrLoad('sample', load)).resolves.toBe('success');

      expect(cacheMock.get).toHaveBeenCalledWith('sample');
      expect(load).toHaveBeenCalledTimes(1);
      expect(cacheMock.set).not.toHaveBeenCalled();
    });

    test('should handle set errors', async () => {
      const cache = new FailSafeCache({
        cache: cacheMock,
        policy: { getOrLoad: 'fail-open' },
      });
      const load = vi.fn().mockResolvedValue('success');

      cacheMock.set.mockRejectedValueOnce(new Error());

      await expect(cache.getOrLoad('sample', load)).resolves.toBe('success');

      expect(cacheMock.get).toHaveBeenCalledWith('sample');
      expect(load).toHaveBeenCalledTimes(1);
      expect(cacheMock.set).toHaveBeenCalledWith('sample', 'success', undefined);
    });

    test('should NOT handle load errors', async () => {
      const cache = new FailSafeCache({
        cache: cacheMock,
        policy: { getOrLoad: 'fail-open' },
      });
      const load = vi.fn().mockRejectedValue(new Error());

      cacheMock.set.mockRejectedValueOnce(new Error());

      await expect(cache.getOrLoad('sample', load)).rejects.throws(Error);

      expect(cacheMock.get).toHaveBeenCalledWith('sample');
      expect(load).toHaveBeenCalledTimes(1);
      expect(cacheMock.set).not.toHaveBeenCalled();
    });
  });

});

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ICache } from '../../types/cache.js';
import { CoalescingCache } from './index.js';

const mockedCache = {
  get: vi.fn(() => waitFor(5).then(() => null)),
  set: vi.fn(() => waitFor(5).then(() => undefined)),
  delete: vi.fn(() => waitFor(5).then(() => undefined)),
  getOrLoad: vi.fn((_, load) => load()),
  getMany: vi.fn(() => waitFor(5).then(() => ({}))),
  setMany: vi.fn(() => waitFor(5).then(() => undefined)),
  deleteMany: vi.fn(() => waitFor(5).then(() => undefined)),
} satisfies ICache;

const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Coalescing Cache', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('get', () => {
    test('should coalesce ongoing requests for the same key', async () => {
      const cache = new CoalescingCache({ cache: mockedCache });

      const [res1, res2, res3] = await Promise.all([
        cache.get('key1'),
        cache.get('key1'),
        cache.get('key2'),
      ]);

      expect(res1).toBeNull();
      expect(res2).toBeNull();
      expect(res3).toBeNull();
      expect(mockedCache.get).toHaveBeenCalledTimes(2);
      expect(mockedCache.get).toHaveBeenCalledWith('key1');
      expect(mockedCache.get).toHaveBeenCalledWith('key2');
    });

    test('should not coalesce sequential requests for the same key', async () => {
      const cache = new CoalescingCache({ cache: mockedCache });

      const res1 = await cache.get('key1');
      const res2 = await cache.get('key1');
      const res3 = await cache.get('key2');

      expect(res1).toBeNull();
      expect(res2).toBeNull();
      expect(res3).toBeNull();
      expect(mockedCache.get).toHaveBeenCalledTimes(3);
      expect(mockedCache.get).toHaveBeenCalledWith('key1');
      expect(mockedCache.get).toHaveBeenCalledWith('key2');
    });
  });

  describe('getOrLoad', () => {
    test('should coalesce ongoing load requests for the same key', async () => {
      const cache = new CoalescingCache({ cache: mockedCache });
      const load = vi.fn(() => waitFor(5).then(() => 'value'));
      const load2 = vi.fn(() => waitFor(5).then(() => null));

      const [res1, res2, res3, res4] = await Promise.all([
        cache.getOrLoad('key1', load),
        cache.getOrLoad('key1', load),
        cache.getOrLoad('key2', load2),
        cache.getOrLoad('key2', load2),
      ]);

      expect(res1).toBe('value');
      expect(res2).toBe('value');
      expect(res3).toBeNull();
      expect(res4).toBeNull();
      expect(load).toHaveBeenCalledTimes(1);
      expect(load2).toHaveBeenCalledTimes(1);
      expect(mockedCache.getOrLoad).toHaveBeenCalledTimes(2);
      expect(mockedCache.getOrLoad).toHaveBeenCalledWith('key1', load, undefined);
      expect(mockedCache.getOrLoad).toHaveBeenCalledWith('key2', load2, undefined);
    });

    test('should coalesce a get request with a load request for the same key', async () => {
      const cache = new CoalescingCache({ cache: mockedCache });
      const load = vi.fn(() => waitFor(5).then(() => 'value'));
      const load2 = vi.fn(() => waitFor(5).then(() => null));

      const [res1, res2, res3, res4] = await Promise.all([
        cache.get('key1'),
        cache.getOrLoad('key1', load),
        cache.get('key2'),
        cache.getOrLoad('key2', load2),
      ]);

      expect(res1).toBeNull();
      expect(res2).toBe('value');
      expect(res3).toBeNull();
      expect(res4).toBeNull();
      expect(load).toHaveBeenCalledTimes(1);
      expect(load2).toHaveBeenCalledTimes(1);
      expect(mockedCache.get).toHaveBeenCalledTimes(2);
      expect(mockedCache.getOrLoad).not.toHaveBeenCalled();
      expect(mockedCache.get).toHaveBeenCalledWith('key1');
      expect(mockedCache.get).toHaveBeenCalledWith('key2');
      expect(mockedCache.set).toHaveBeenCalledTimes(1);
      expect(mockedCache.set).toHaveBeenCalledWith('key1', 'value', undefined);
    });
  });

  describe('set', () => {
    test('should set values correctly', async () => {
      const cache = new CoalescingCache({ cache: mockedCache });

      await cache.set('key1', 'value1', { ttl: 30 });

      expect(mockedCache.set).toHaveBeenCalledWith('key1', 'value1', { ttl: 30 });
    });

    test('should coalesce get for ongoing set requests', async () => {
      const cache = new CoalescingCache({ cache: mockedCache });
      const load = vi.fn().mockResolvedValue('value2');

      const [_, res1, res2] = await Promise.all([
        cache.set('key1', 'value1', { ttl: 30 }),
        cache.get('key1'),
        cache.getOrLoad('key1', load),
      ]);

      expect(res1).toBe('value1');
      expect(res2).toBe('value1');
      expect(mockedCache.set).toHaveBeenCalledWith('key1', 'value1', { ttl: 30 });
      expect(mockedCache.get).not.toHaveBeenCalled();
      expect(mockedCache.getOrLoad).not.toHaveBeenCalled();
      expect(load).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    test('should delete values correctly', async () => {
      const cache = new CoalescingCache({ cache: mockedCache });

      await cache.delete('key1');

      expect(mockedCache.delete).toHaveBeenCalledWith('key1');
    });

    test('should clear ongoing requests', async () => {
      const cache = new CoalescingCache({ cache: mockedCache });

      mockedCache.get.mockImplementationOnce(() => waitFor(5).then<any>(() => 'value'));

      const [res1, _, res2] = await Promise.all([
        cache.get('key1'),
        cache.delete('key1'),
        cache.get('key1'),
      ]);

      expect(res1).toBe('value');
      expect(res2).toBeNull();
      expect(mockedCache.get).toHaveBeenCalledTimes(1);
      expect(mockedCache.delete).toHaveBeenCalledTimes(1);
      expect(mockedCache.get).toHaveBeenCalledWith('key1');
      expect(mockedCache.delete).toHaveBeenCalledWith('key1');
    });
  });

  describe('getMany', () => {
    test('should coalesce get calls with a getMany call', async () => {
      const cache = new CoalescingCache({ cache: mockedCache });
      const load = vi.fn().mockResolvedValue('value2');

      await Promise.all([
        cache.get('key1'),
        cache.getOrLoad('key2', load),
        cache.getMany(['key1', 'key2', 'key3']),
        cache.get('key3'),
      ]);

      expect(mockedCache.get).toHaveBeenCalledWith('key1');
      expect(mockedCache.getOrLoad).toHaveBeenCalledWith('key2', load, undefined);
      expect(mockedCache.getMany).toHaveBeenCalledWith(['key3']);
      expect(mockedCache.get).toHaveBeenCalledTimes(1);
      expect(mockedCache.getOrLoad).toHaveBeenCalledTimes(1);
      expect(mockedCache.getMany).toHaveBeenCalledTimes(1);
    });

    test('should not call getMany when all get calls are coalesced', async () => {
      const cache = new CoalescingCache({ cache: mockedCache });
      const load = vi.fn().mockResolvedValue('value2');

      await Promise.all([
        cache.get('key1'),
        cache.getOrLoad('key2', load),
        cache.getMany(['key1', 'key2']),
      ]);

      expect(mockedCache.get).toHaveBeenCalledWith('key1');
      expect(mockedCache.getOrLoad).toHaveBeenCalledWith('key2', load, undefined);
      expect(mockedCache.getMany).not.toHaveBeenCalled();
      expect(mockedCache.get).toHaveBeenCalledTimes(1);
      expect(mockedCache.getOrLoad).toHaveBeenCalledTimes(1);
    });
  });

  describe('setMany', () => {
    test('should set values correctly', async () => {
      const cache = new CoalescingCache({ cache: mockedCache });

      await cache.setMany({ key1: 'value1', key2: 'value2' }, { ttl: 30 });

      expect(mockedCache.setMany).toHaveBeenCalledWith({ key1: 'value1', key2: 'value2' }, { ttl: 30 });
    });

    test('should coalesce get for ongoing setMany requests', async () => {
      const cache = new CoalescingCache({ cache: mockedCache });
      const load = vi.fn().mockResolvedValue('sample');

      const [_, res1, res2] = await Promise.all([
        cache.setMany({ key1: 'value1', key2: 'value2' }),
        cache.get('key1'),
        cache.getOrLoad('key2', load),
      ]);

      expect(res1).toBe('value1');
      expect(res2).toBe('value2');
      expect(mockedCache.setMany).toHaveBeenCalledWith({ key1: 'value1', key2: 'value2' }, undefined);
      expect(mockedCache.get).not.toHaveBeenCalled();
      expect(mockedCache.getOrLoad).not.toHaveBeenCalled();
      expect(load).not.toHaveBeenCalled();
    });
  });

  describe('deleteMany', () => {
    test('should delete values correctly', async () => {
      const cache = new CoalescingCache({ cache: mockedCache });

      await cache.deleteMany(['key1', 'key2']);

      expect(mockedCache.deleteMany).toHaveBeenCalledWith(['key1', 'key2']);
    });

    test('should clear ongoing requests', async () => {
      const cache = new CoalescingCache({ cache: mockedCache });

      mockedCache.getMany.mockImplementationOnce(() => waitFor(5).then<any>(() => ({
        key1: 'value1',
        key2: 'value2',
      })));

      const [res1, _, res2] = await Promise.all([
        cache.getMany(['key1', 'key2']),
        cache.deleteMany(['key1', 'key2']),
        cache.getMany(['key1', 'key2']),
      ]);

      expect(res1).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
      expect(res2).toEqual({
        key1: null,
        key2: null,
      });
      expect(mockedCache.getMany).toHaveBeenCalledTimes(1);
      expect(mockedCache.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockedCache.getMany).toHaveBeenCalledWith(['key1', 'key2']);
      expect(mockedCache.deleteMany).toHaveBeenCalledWith(['key1', 'key2']);
    });
  });
})

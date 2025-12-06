import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MetricsCollectingCache } from './index.js';

const mockCache = {
  get: vi.fn(),
  getOrLoad: vi.fn((_, load) => load()),
  set: vi.fn(),
  delete: vi.fn(),
  getMany: vi.fn(),
  setMany: vi.fn(),
  deleteMany: vi.fn(),
};

describe('MetricsCollectingCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    test('increments miss count and time on cache miss', async () => {
      const cache = new MetricsCollectingCache({ cache: mockCache });
      mockCache.get.mockResolvedValueOnce(null);

      await cache.get('missing-key');

      expect(mockCache.get).toHaveBeenCalledWith('missing-key');
      expect(cache.getMetrics().missCount).toBe(1);
      expect(cache.getMetrics().hitCount).toBe(0);
    });

    test('increments hit count and time on cache hit', async () => {
      const cache = new MetricsCollectingCache({ cache: mockCache });
      mockCache.get.mockResolvedValueOnce('value');

      await cache.get('existing-key');

      expect(mockCache.get).toHaveBeenCalledWith('existing-key');
      expect(cache.getMetrics().hitCount).toBe(1);
      expect(cache.getMetrics().missCount).toBe(0);
    });
  });

  describe('getOrLoad', () => {
    test('increments load count and time on cache miss with load', async () => {
      const cache = new MetricsCollectingCache({ cache: mockCache });
      const load = vi.fn().mockResolvedValue('loaded-value');

      await cache.getOrLoad('key', load);

      expect(mockCache.getOrLoad).toHaveBeenCalledWith('key', expect.any(Function), undefined);
      expect(cache.getMetrics().loadCount).toBe(1);
      expect(cache.getMetrics().missCount).toBe(1);
      expect(cache.getMetrics().setCount).toBe(1);
      expect(cache.getMetrics().hitCount).toBe(0);
    });

    test('increments hit count and time on cache hit', async () => {
      const cache = new MetricsCollectingCache({ cache: mockCache });
      const load = vi.fn();
      mockCache.getOrLoad.mockResolvedValueOnce('cached-value');

      await cache.getOrLoad('key', load);

      expect(mockCache.getOrLoad).toHaveBeenCalledWith('key', expect.any(Function), undefined);
      expect(cache.getMetrics().hitCount).toBe(1);
      expect(cache.getMetrics().loadCount).toBe(0);
    });
  });

  describe('set', () => {
    test('increments set count and time', async () => {
      const cache = new MetricsCollectingCache({ cache: mockCache });

      await cache.set('key', 'value');

      expect(mockCache.set).toHaveBeenCalledWith('key', 'value', undefined);
      expect(cache.getMetrics().setCount).toBe(1);
    });
  });

  describe('delete', () => {
    test('increments delete count and time', async () => {
      const cache = new MetricsCollectingCache({ cache: mockCache });

      await cache.delete('key');

      expect(mockCache.delete).toHaveBeenCalledWith('key');
      expect(cache.getMetrics().deleteCount).toBe(1);
    });
  });

  describe('getMany', () => {
    test('increments hit and miss counts for multiple keys', async () => {
      const cache = new MetricsCollectingCache({ cache: mockCache });
      mockCache.getMany.mockResolvedValueOnce({
        key1: 'value1',
        key2: null,
        key3: 'value3',
      });

      await cache.getMany(['key1', 'key2', 'key3']);

      expect(mockCache.getMany).toHaveBeenCalledWith(['key1', 'key2', 'key3']);
      expect(cache.getMetrics().hitCount).toBe(2);
      expect(cache.getMetrics().missCount).toBe(1);
    });
  });

  describe('setMany', () => {
    test('increments set count for multiple keys', async () => {
      const cache = new MetricsCollectingCache({ cache: mockCache });
      const data = { key1: 'value1', key2: 'value2' };

      await cache.setMany(data);

      expect(mockCache.setMany).toHaveBeenCalledWith(data, undefined);
      expect(cache.getMetrics().setCount).toBe(2);
    });
  });

  describe('deleteMany', () => {
    test('increments delete count for multiple keys', async () => {
      const cache = new MetricsCollectingCache({ cache: mockCache });

      await cache.deleteMany(['key1', 'key2']);

      expect(mockCache.deleteMany).toHaveBeenCalledWith(['key1', 'key2']);
      expect(cache.getMetrics().deleteCount).toBe(2);
    });
  });

  describe('resetMetrics', () => {
    test('resets all metrics to zero', () => {
      const cache = new MetricsCollectingCache({ cache: mockCache });
      cache.resetMetrics();

      const metrics = cache.getMetrics();
      expect(metrics.missCount).toBe(0);
      expect(metrics.hitCount).toBe(0);
      expect(metrics.loadCount).toBe(0);
      expect(metrics.setCount).toBe(0);
      expect(metrics.deleteCount).toBe(0);
    });
  });
});

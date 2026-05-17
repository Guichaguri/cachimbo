import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import { IndexedDBCache, type IndexedDBCacheOptions } from './index.js';

describe('IndexedDBCache', () => {
  let cacheId = 0;

  const createCache = (options: Partial<IndexedDBCacheOptions> = {}) => {
    cacheId++;
    return new IndexedDBCache({
      dbName: `test-db-${cacheId}`,
      ...options,
    });
  };

  describe('get / set', () => {
    test('returns value for an existing key', async () => {
      const cache = createCache();
      await cache.set('existing-key', { key: 'value' });

      const result = await cache.get('existing-key');

      expect(result).toEqual({ key: 'value' });
    });

    test('returns null for a non-existing key', async () => {
      const cache = createCache();

      const result = await cache.get('non-existing-key');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    test('removes the key from the cache', async () => {
      const cache = createCache();
      await cache.set('key', { key: 'value' });
      await cache.delete('key');

      const result = await cache.get('key');
      expect(result).toBeNull();
    });
  });

  describe('getMany / setMany', () => {
    test('returns multiple values', async () => {
      const cache = createCache();
      await cache.setMany({
        key1: 'value1',
        key2: 'value2',
      });

      const result = await cache.getMany(['key1', 'key2', 'key3']);

      expect(result).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: null,
      });
    });
  });

  describe('deleteMany', () => {
    test('removes multiple keys from the cache', async () => {
      const cache = createCache();
      await cache.setMany({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      });

      await cache.deleteMany(['key1', 'key2']);

      const result = await cache.getMany(['key1', 'key2', 'key3']);

      expect(result).toEqual({
        key1: null,
        key2: null,
        key3: 'value3',
      });
    });
  });

  describe('evict', () => {
    const count = (cache: IndexedDBCache): Promise<number> =>
      (cache as any).do('readonly', (store: IDBObjectStore) => (cache as any).promisifyRequest(store.count()));

    test('evicts expired keys from the cache', async () => {
      const cache = createCache({ shouldAutoEvict: false });
      await cache.setMany({ key1: 'value1', key2: 'value2' }, { ttl: 0.1 });
      await cache.set('key3', 'value3', { ttl: 100 });
      await cache.set('key4', 'value4');

      await new Promise(resolve => setTimeout(resolve, 100));

      const resultPreEviction = await cache.getMany(['key1', 'key2', 'key3', 'key4']);

      expect(await count(cache)).toBe(4);

      await cache.evict();

      const result = await cache.getMany(['key1', 'key2', 'key3', 'key4']);

      expect(result).toEqual({
        key1: null,
        key2: null,
        key3: 'value3',
        key4: 'value4',
      });
      expect(result).toEqual(resultPreEviction);
      expect(await count(cache)).toBe(2);
    });

    test('evicts expired keys automatically', async () => {
      const cache = createCache({ shouldAutoEvict: true });
      await cache.setMany({ key1: 'value1', key2: 'value2' }, { ttl: 0.1 });
      await cache.set('key3', 'value3', { ttl: 100 });
      await cache.set('key4', 'value4');

      await new Promise(resolve => setTimeout(resolve, 100));

      await cache.getMany(['key1', 'key2']); // Marks for eviction
      await cache.set('key4', 'value-updated'); // Evicts

      const result = await cache.getMany(['key1', 'key2', 'key3', 'key4']);

      expect(result).toEqual({
        key1: null,
        key2: null,
        key3: 'value3',
        key4: 'value-updated',
      });
      expect(await count(cache)).toBe(2);
    });
  });

  describe('clear', () => {
    test('clears all keys from the cache', async () => {
      const cache = createCache();
      await cache.setMany({
        key1: 'value1',
        key2: 'value2',
      });

      await cache.clear();

      const result = await cache.getMany(['key1', 'key2']);

      expect(result).toEqual({
        key1: null,
        key2: null,
      });
    });
  });

  describe('error handling', () => {
    test('throws an error when an IndexedDB request fails', async () => {
      const mockIndexedDB = {
        open: () => {
          const request: any = {};
          setTimeout(() => {
            request.error = new Error('Simulated IndexedDB error');
            if (request.onerror) request.onerror(new Event('error'));
          }, 0);
          return request;
        },
      } as unknown as IDBFactory;

      const cache = new IndexedDBCache({
        indexedDB: mockIndexedDB,
        dbName: 'error-test-db',
      });

      await expect(cache.get('key')).rejects.toThrow('Simulated IndexedDB error');
    });
  });
});

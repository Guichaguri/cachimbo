import { describe, expect, test, vi, beforeEach } from 'vitest';
import { WeakCache } from './index.js';
import { LocalMapCache } from '../map/index.js';

describe('WeakCache', () => {
  let underlyingCache: LocalMapCache;
  let weakCache: WeakCache;

  beforeEach(() => {
    underlyingCache = new LocalMapCache();
    weakCache = new WeakCache({ cache: underlyingCache });
  });

  test('should set and get values', async () => {
    await weakCache.set('key1', { data: 'value1' });

    expect(await weakCache.get('key1')).toEqual({ data: 'value1' });
  });

  test('should set and get primitive values', async () => {
    await weakCache.set('key1', 'value1');

    expect(await weakCache.get('key1')).toEqual('value1');
  });

  test('should return null for finalized objects', async () => {
    await weakCache.set('test123', { data: 'value2' });

    // Simulate garbage collection
    (weakCache as any).onGarbageCollect('test123');

    expect(await weakCache.get('test123')).toBeNull();
  });

  test('should return null for pre-finalized garbage collected objects', async () => {
    await weakCache.set('test123', { data: 'value2' });

    // Simulate weak reference already cleared
    await underlyingCache.set('test123', { v: { deref: () => null }, w: true });

    expect(await weakCache.get('test123')).toBeNull();
  });

  test('should delete values', async () => {
    await weakCache.set('key3', { data: 'value3' });
    await weakCache.delete('key3');
    expect(await weakCache.get('key3')).toBeNull();
  });

  test('should handle multiple keys', async () => {
    await weakCache.setMany({
      key4: { data: 'value4' },
      key5: { data: 'value5' },
    });

    expect(await weakCache.getMany(['key4', 'key5'])).toEqual({
      key4: { data: 'value4' },
      key5: { data: 'value5' },
    });

    await weakCache.deleteMany(['key4', 'key5']);

    expect(await weakCache.getMany(['key4', 'key5'])).toEqual({
      key4: null,
      key5: null,
    });
  });

  test('should load values using getOrLoad', async () => {
    const loader = vi.fn(async () => ({ data: 'loadedValue' }));

    const value = await weakCache.getOrLoad('key6', loader);
    expect(value).toEqual({ data: 'loadedValue' });
    expect(loader).toHaveBeenCalledTimes(1);

    // Should not call loader again for the same key
    const cachedValue = await weakCache.getOrLoad('key6', loader);
    expect(cachedValue).toEqual({ data: 'loadedValue' });
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

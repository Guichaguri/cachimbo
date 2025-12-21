import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseLocalCache } from './local.js';

class TestLocalCache extends BaseLocalCache {
  constructor() { super({}); }
  private store = new Map<string, any>();

  _get<T>(key: string): T | null {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  _set<T>(key: string, value: T, options?: any): void {
    const existed = this.store.has(key);
    const prev = this.store.get(key);
    this.store.set(key, value);
    // If there was a previous value, consider it disposed by replacement
    if (existed) this.onDispose(key, prev, 'set');
  }

  _delete(key: string): void {
    const existed = this.store.has(key);
    const prev = this.store.get(key);
    if (existed) {
      this.store.delete(key);
      this.onDispose(key, prev, 'delete');
    }
  }
}

describe('BaseLocalCache (TestLocalCache)', () => {
  let cache: TestLocalCache;

  beforeEach(() => {
    cache = new TestLocalCache();
  });

  it('basic CRUD via promise wrappers', async () => {
    expect(await cache.get('missing')).toBeNull();

    await cache.set('a', 1);
    expect(await cache.get('a')).toBe(1);

    await cache.delete('a');
    expect(await cache.get('a')).toBeNull();
  });

  it('getMany/setMany/deleteMany parity', async () => {
    await cache.setMany({ a: 1, b: 2 });
    expect(await cache.getMany(['a', 'b'])).toEqual({ a: 1, b: 2 });

    await cache.deleteMany(['a', 'b']);
    expect(await cache.getMany(['a', 'b'])).toEqual({ a: null, b: null });
  });

  it('dispose listeners called on replace and delete', async () => {
    const spy1 = vi.fn();
    const spy2 = vi.fn();

    cache._addDisposeListener(spy1);
    cache._addDisposeListener(spy2);

    // first set shouldn't dispose (no previous value)
    await cache.set('k', 1);
    expect(spy1).not.toHaveBeenCalled();

    // replace should trigger dispose with previous value
    await cache.set('k', 2);
    expect(spy1).toHaveBeenCalledWith('k', 1, 'set');
    expect(spy2).toHaveBeenCalledWith('k', 1, 'set');

    // delete should trigger dispose with last value
    await cache.delete('k');
    expect(spy1).toHaveBeenCalledWith('k', 2, 'delete');
  });

  it('overridden _getMany is used by getMany', async () => {
    // Spy the prototype method by creating a subclass that doesn't change behavior
    class OverrideLocalCache extends TestLocalCache {}

    const spy = vi.spyOn(OverrideLocalCache.prototype as any, '_getMany');
    const oc = new OverrideLocalCache();

    await oc.setMany({ a: 1, b: 2 });
    await oc.getMany(['a', 'b']);

    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it('handles null values and empty inputs', async () => {
    await cache.set('n', null);
    expect(await cache.get('n')).toBeNull();

    await cache.setMany({});
    expect(await cache.getMany([])).toEqual({});
  });
});

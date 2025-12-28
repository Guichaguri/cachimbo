import { beforeEach, describe, expect, test, vi } from 'vitest';
import { BaseLocalCache } from '../../base/local.js';
import { DeepCloningCache } from './index.js';
import { LocalMapCache } from '../map/index.js';

class MockLocalCache extends BaseLocalCache {
  constructor() { super({}); }
  _get = vi.fn();
  _set = vi.fn();
  _delete = vi.fn();
  override _getMany = vi.fn();
  override _setMany = vi.fn();
  override _deleteMany = vi.fn();
  override _addDisposeListener = vi.fn();
}

const mockedCache = new MockLocalCache();

describe('DeepCloningCache', () => {
  const structuredCloneOriginal = globalThis.structuredClone;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.structuredClone = structuredCloneOriginal;
  });

  test('should create an instance with structuredClone', async () => {
    globalThis.structuredClone = vi.fn((v) => v);

    const cache = new DeepCloningCache({ cache: new LocalMapCache() });
    const obj: any = { a: 1 };

    await cache.set("key1", obj);

    expect(globalThis.structuredClone).toHaveBeenCalledWith(obj);
  });

  test('should create an instance with a custom deep clone function', async () => {
    const deepClone = vi.fn((v) => v);

    const cache = new DeepCloningCache({ cache: new LocalMapCache(), deepClone });
    const obj: any = { a: 1 };

    await cache.set("key1", obj);

    expect(deepClone).toHaveBeenCalledWith(obj);
  });

  test('should create an instance with JSON deep clone polyfill', async () => {
    globalThis.structuredClone = undefined as any;

    const cache = new DeepCloningCache({ cache: new LocalMapCache() });
    const obj: any = { a: 1 };

    await cache.set("key1", obj);

    obj.b = 2;

    const obj2 = await cache.get("key1");
    const obj3 = await cache.get("unknown");

    expect(obj3).toBeNull();
    expect(obj2).toEqual({ a: 1 });
    expect(obj).toEqual({ a: 1, b: 2 });
  });

  test('should deep clone on get and set', async () => {
    const cache = new DeepCloningCache({ cache: new LocalMapCache() });
    const obj: any = { a: 1 };

    await cache.set("key1", obj);

    obj.b = 2;

    const obj2 = await cache.get<any>("key1");

    obj2.c = 3;

    const obj3 = await cache.get<any>("key1");

    expect(obj3).toEqual({ a: 1 });
    expect(obj2).toEqual({ a: 1, c: 3 });
    expect(obj).toEqual({ a: 1, b: 2 });
  });

  test('should passthrough delete', async () => {
    const cache = new DeepCloningCache({ cache: mockedCache });

    await cache.delete("key1");

    expect(mockedCache._delete).toHaveBeenCalledWith("key1");
  });

  test('should deep clone getMany and setMany', async () => {
    const cache = new DeepCloningCache({ cache: new LocalMapCache() });
    const obj: any = { a: 1 };

    await cache.setMany({ key1: obj });

    obj.b = 2;

    const obj2 = await cache.getMany<any>(["key1"]);

    obj2.key1.c = 3;

    const obj3 = await cache.getMany<any>(["key1"]);

    expect(obj3.key1).toEqual({ a: 1 });
    expect(obj2.key1).toEqual({ a: 1, c: 3 });
    expect(obj).toEqual({ a: 1, b: 2 });
  });

  test('should passthrough deleteMany', async () => {
    const cache = new DeepCloningCache({ cache: mockedCache });

    await cache.deleteMany(["key1"]);

    expect(mockedCache._deleteMany).toHaveBeenCalledWith(["key1"]);
  });

  test('should deep clone getOrLoad', async () => {
    const cache = new DeepCloningCache({ cache: new LocalMapCache() });
    const obj: any = { a: 1 };

    const obj2 = await cache.getOrLoad("key1", async () => obj);

    obj.b = 2;
    obj2.c = 3;

    const obj3 = await cache.getOrLoad("key1", async () => obj);

    expect(obj3).toEqual({ a: 1 });
    expect(obj2).toEqual({ a: 1, c: 3 });
    expect(obj).toEqual({ a: 1, b: 2 });
  });

  test('should passthrough _addDisposeListener', async () => {
    const cache = new DeepCloningCache({ cache: mockedCache });
    const listener = vi.fn();

    cache.internal._addDisposeListener(listener);

    expect(mockedCache._addDisposeListener).toHaveBeenCalledWith(listener);
  });

});

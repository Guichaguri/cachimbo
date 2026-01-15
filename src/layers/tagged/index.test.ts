import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { ICache } from '../../types/cache.js';
import { LocalMapCache } from '../../local/map/index.js';
import { TaggedCache } from './index.js';

const mockCache = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn(),
  delete: vi.fn(),
  getMany: vi.fn().mockResolvedValue({}),
  setMany: vi.fn(),
  deleteMany: vi.fn(),
  getOrLoad: vi.fn().mockResolvedValue(null),
} satisfies ICache;

const wait = (ms: number = 2) => new Promise((resolve) => setTimeout(resolve, ms));

describe('TaggedCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should get a value from the cache', async () => {
    const taggingCache = new TaggedCache({ cache: mockCache });
    const key = 'test-key';
    const value = { v: 'test-value', d: Date.now(), t: [] };
    mockCache.get.mockResolvedValue(value);

    const result = await taggingCache.get(key);

    expect(result).toBe(value.v);
    expect(mockCache.get).toHaveBeenCalledWith(key);
  });

  test('should set a value in the cache', async () => {
    const taggingCache = new TaggedCache({ cache: mockCache });
    const key = 'test-key';
    const value = 'test-value';
    const tags = ['tag1', 'tag2'];

    await taggingCache.set(key, value, { tags });

    expect(mockCache.set).toHaveBeenCalledWith(
      key,
      expect.objectContaining({ v: value, t: tags }),
      expect.any(Object)
    );
  });

  test('should delete a value from the cache', async () => {
    const taggingCache = new TaggedCache({ cache: mockCache });
    const key = 'test-key';

    await taggingCache.delete(key);

    expect(mockCache.delete).toHaveBeenCalledWith(key);
  });

  test('should delete many keys', async () => {
    const taggingCache = new TaggedCache({ cache: mockCache });
    const key = 'test-key';

    await taggingCache.deleteMany([key]);

    expect(mockCache.deleteMany).toHaveBeenCalledWith([key]);
  });

  test('should invalidate a tag', async () => {
    const taggingCache = new TaggedCache({ cache: mockCache });
    const tag = 'test-tag';

    await taggingCache.invalidateTag(tag);

    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining(tag),
      expect.any(Number),
      expect.objectContaining({ ttl: expect.any(Number) })
    );
  });

  test('should return null for invalidated tags in get', async () => {
    const taggingCache = new TaggedCache({ cache: new LocalMapCache() });

    await taggingCache.set('key1', 'value1', { tags: ['tag1'] });
    await taggingCache.set('key2', 'value2', { tags: ['tag2'] });

    await wait(); // Needs to wait a millisecond to ensure different timestamps

    await taggingCache.invalidateTags(['tag1', 'tag3']);

    const value1 = await taggingCache.get<string>('key1');
    const value2 = await taggingCache.get<string>('key2');
    const value3 = await taggingCache.get<string>('key3');

    expect(value1).toBeNull();
    expect(value2).toBe('value2');
    expect(value3).toBeNull();
  });

  test('should return null for invalidated tags in getMany', async () => {
    const taggingCache = new TaggedCache({ cache: new LocalMapCache() });

    await taggingCache.set('key1', 'value1', { tags: ['tag1'] });
    await taggingCache.set('key2', 'value2', { tags: ['tag2'] });

    await wait(); // Needs to wait a millisecond to ensure different timestamps

    await taggingCache.invalidateTags(['tag1', 'tag3']);

    const { key1, key2, key3 } = await taggingCache.getMany<string>(['key1', 'key2', 'key3']);

    expect(key1).toBeNull();
    expect(key2).toBe('value2');
    expect(key3).toBeNull();
  });

  test('should not return null for old invalidations', async () => {
    const taggingCache = new TaggedCache({ cache: new LocalMapCache() });

    await taggingCache.setMany({ key1: 'value1', key2: 'value2' }, { tags: ['tag1'] });

    await wait();

    await taggingCache.invalidateTag('tag1');

    await wait();

    await taggingCache.set('key2', 'value2', { tags: ['tag1'] });

    const { key1, key2 } = await taggingCache.getMany<string>(['key1', 'key2']);

    expect(key1).toBeNull();
    expect(key2).toBe('value2');
  });

  test('should clear up tags', async () => {
    const taggingCache = new TaggedCache({ cache: new LocalMapCache() });

    await taggingCache.setMany({ key1: 'value2', key2: 'value3', key3: 'value5' }, { tags: ['tag1'] });
    await taggingCache.set('key1', 'value1');
    await taggingCache.setMany({ key2: 'value4' });

    await wait();

    await taggingCache.invalidateTag('tag1');

    await wait();

    const value1 = await taggingCache.get<string>('key1');
    const value2 = await taggingCache.get<string>('key2');
    const value3 = await taggingCache.get<string>('key3');

    expect(value1).toBe('value1');
    expect(value2).toBe('value4');
    expect(value3).toBeNull();
  });

  test('should return null on missing key successfully', async () => {
    const taggingCache = new TaggedCache({ cache: new LocalMapCache() });

    const value = await taggingCache.get<string>('unknown');

    expect(value).toBeNull();
  });

  test('should load from source if not in cache', async () => {
    const taggingCache = new TaggedCache({ cache: new LocalMapCache() });
    const load = vi.fn().mockResolvedValue('value-from-source');

    const value = await taggingCache.getOrLoad('key1', load);
    const value2 = await taggingCache.get('key1');

    expect(load).toHaveBeenCalled();
    expect(value).toBe('value-from-source');
    expect(value2).toBe('value-from-source');
  });

  test('should load from cache and not from source', async () => {
    const taggingCache = new TaggedCache({ cache: new LocalMapCache() });
    const load = vi.fn().mockResolvedValue('value-from-source');

    await taggingCache.set('key1', 'cached-value');

    const value = await taggingCache.getOrLoad('key1', load);

    expect(load).not.toHaveBeenCalled();
    expect(value).toBe('cached-value');
  });

  test('should load from cache if tag is invalidated', async () => {
    const taggingCache = new TaggedCache({ cache: new LocalMapCache() });
    const load = vi.fn().mockResolvedValue('value-from-source');

    await taggingCache.set('key1', 'cached-value', { tags: ['tag1'] });

    await wait();

    await taggingCache.invalidateTag('tag1');

    await wait();

    const value = await taggingCache.getOrLoad('key1', load, { tags: ['tag1'] });

    expect(load).toHaveBeenCalled();
    expect(value).toBe('value-from-source');
  });
});

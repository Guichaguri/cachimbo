import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { IMap } from 'hazelcast-client';
import { HazelcastCache } from './index.js';

const mockMap = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
} satisfies Partial<IMap<string, any>>;

const cache = new HazelcastCache({ map: mockMap as any });

describe('HazelcastCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should get a value by key', async () => {
    const key = 'test-key';
    const value = 'test-value';
    mockMap.get.mockResolvedValue(value);

    const result = await cache.get(key);

    expect(mockMap.get).toHaveBeenCalledWith(key);
    expect(result).toBe(value);
  });

  test('should set a value with a key', async () => {
    const key = 'test-key';
    const value = 'test-value';
    const ttl = 1000;

    await cache.set(key, value, { ttl });

    expect(mockMap.set).toHaveBeenCalledWith(key, value, ttl);
  });

  test('should delete a value by key', async () => {
    const key = 'test-key';

    await cache.delete(key);

    expect(mockMap.delete).toHaveBeenCalledWith(key);
  });

  test('should get multiple values by keys', async () => {
    const keys = ['key1', 'key2'];
    const entries = new Map([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ]);
    mockMap.getAll.mockResolvedValue(entries);

    const result = await cache.getMany(keys);

    expect(mockMap.getAll).toHaveBeenCalledWith(keys);
    expect(result).toEqual({ key1: 'value1', key2: 'value2' });
  });
});

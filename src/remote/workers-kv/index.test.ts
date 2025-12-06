import { describe, test, expect, vi } from 'vitest';
import type { KVNamespace } from '@cloudflare/workers-types';
import { WorkersKVCache } from './index.js';

const mockKVNamespace = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  getWithMetadata: vi.fn(),
} satisfies KVNamespace;

describe('WorkersKVCache', () => {
  describe('get', () => {
    test('returns the value for an existing key', async () => {
      const cache = new WorkersKVCache({ kv: mockKVNamespace });
      mockKVNamespace.get.mockResolvedValueOnce({ key: 'value' });

      const result = await cache.get('existing-key');

      expect(result).toEqual({ key: 'value' });
      expect(mockKVNamespace.get).toHaveBeenCalledWith('existing-key', { type: 'json' });
    });

    test('returns null for a non-existing key', async () => {
      const cache = new WorkersKVCache({ kv: mockKVNamespace });
      mockKVNamespace.get.mockResolvedValueOnce(null);

      const result = await cache.get('non-existing-key');

      expect(result).toBeNull();
      expect(mockKVNamespace.get).toHaveBeenCalledWith('non-existing-key', { type: 'json' });
    });
  });

  describe('set', () => {
    test('stores the value with the specified TTL', async () => {
      const cache = new WorkersKVCache({ kv: mockKVNamespace });
      const value = { key: 'value' };

      await cache.set('key', value, { ttl: 60 });

      expect(mockKVNamespace.put).toHaveBeenCalledWith('key', JSON.stringify(value), { expirationTtl: 60 });
    });

    test('stores the value without TTL when not specified', async () => {
      const cache = new WorkersKVCache({ kv: mockKVNamespace });
      const value = { key: 'value' };

      await cache.set('key', value);

      expect(mockKVNamespace.put).toHaveBeenCalledWith('key', JSON.stringify(value), { expirationTtl: undefined });
    });
  });

  describe('delete', () => {
    test('removes the key from the cache', async () => {
      const cache = new WorkersKVCache({ kv: mockKVNamespace });

      await cache.delete('key');

      expect(mockKVNamespace.delete).toHaveBeenCalledWith('key');
    });
  });

  describe('getMany', () => {
    test('returns values for multiple keys', async () => {
      const cache = new WorkersKVCache({ kv: mockKVNamespace });
      mockKVNamespace.get.mockResolvedValueOnce([
        ['key1', { key: 'value1' }],
        ['key2', { key: 'value2' }],
      ]);

      const result = await cache.getMany(['key1', 'key2']);

      expect(result).toEqual({
        key1: { key: 'value1' },
        key2: { key: 'value2' },
      });
      expect(mockKVNamespace.get).toHaveBeenCalledWith(['key1', 'key2'], { type: 'json' });
    });

    test('returns null for keys that do not exist', async () => {
      const cache = new WorkersKVCache({ kv: mockKVNamespace });
      mockKVNamespace.get.mockResolvedValueOnce([
        ['key1', { key: 'value1' }],
        ['key2', null],
      ]);

      const result = await cache.getMany(['key1', 'key2']);

      expect(result).toEqual({
        key1: { key: 'value1' },
        key2: null,
      });
      expect(mockKVNamespace.get).toHaveBeenCalledWith(['key1', 'key2'], { type: 'json' });
    });
  });
});

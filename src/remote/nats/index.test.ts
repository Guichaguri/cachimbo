import { describe, expect, test, vi, beforeEach } from 'vitest';
import { NatsCache } from './index.js';

const mockKv = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  purge: vi.fn(),
} as any;

describe('NatsCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    test('returns parsed value for an existing key', async () => {
      const cache = new NatsCache({ kv: mockKv });
      mockKv.get.mockResolvedValueOnce({
        operation: 'PUT',
        json: () => ({ key: 'value' })
      });

      const result = await cache.get('existing-key');

      expect(result).toEqual({ key: 'value' });
      expect(mockKv.get).toHaveBeenCalledWith('existing-key');
    });

    test('returns null for a non-existing key', async () => {
      const cache = new NatsCache({ kv: mockKv });
      mockKv.get.mockResolvedValueOnce(null);

      const result = await cache.get('non-existing-key');

      expect(result).toBeNull();
      expect(mockKv.get).toHaveBeenCalledWith('non-existing-key');
    });

    test('returns null for a soft-deleted key', async () => {
      const cache = new NatsCache({ kv: mockKv });
      mockKv.get.mockResolvedValueOnce({ operation: 'DEL' });

      const result = await cache.get('deleted-key');

      expect(result).toBeNull();
      expect(mockKv.get).toHaveBeenCalledWith('deleted-key');
    });

    test('returns null for a purged key', async () => {
      const cache = new NatsCache({ kv: mockKv });
      mockKv.get.mockResolvedValueOnce({ operation: 'PURGE' });

      const result = await cache.get('purged-key');

      expect(result).toBeNull();
      expect(mockKv.get).toHaveBeenCalledWith('purged-key');
    });
  });

  describe('set', () => {
    test('stores the value', async () => {
      const cache = new NatsCache({ kv: mockKv });
      const value = { key: 'value' };

      await cache.set('key', value);

      expect(mockKv.put).toHaveBeenCalledWith(
        'key',
        JSON.stringify(value)
      );
    });
  });

  describe('delete', () => {
    test('soft-deletes the key from the cache by default', async () => {
      const cache = new NatsCache({ kv: mockKv });

      await cache.delete('key');

      expect(mockKv.delete).toHaveBeenCalledWith('key');
      expect(mockKv.purge).not.toHaveBeenCalled();
    });

    test('hard-deletes the key from the cache when enabled', async () => {
      const cache = new NatsCache({ kv: mockKv, isHardDeleteEnabled: true });

      await cache.delete('key');

      expect(mockKv.purge).toHaveBeenCalledWith('key');
      expect(mockKv.delete).not.toHaveBeenCalled();
    });
  });
});

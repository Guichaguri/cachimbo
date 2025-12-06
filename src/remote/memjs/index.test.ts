import { describe, expect, test, vi } from 'vitest';
import { MemJSCache } from './index.js';

const mockMemJSClient = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
} as any;

describe('MemJSCache', () => {
  describe('get', () => {
    test('returns parsed value for an existing key', async () => {
      const cache = new MemJSCache({ client: mockMemJSClient });
      mockMemJSClient.get.mockResolvedValueOnce({ value: Buffer.from(JSON.stringify({ key: 'value' })) });

      const result = await cache.get('existing-key');

      expect(result).toEqual({ key: 'value' });
      expect(mockMemJSClient.get).toHaveBeenCalledWith('existing-key');
    });

    test('returns null for a non-existing key', async () => {
      const cache = new MemJSCache({ client: mockMemJSClient });
      mockMemJSClient.get.mockResolvedValueOnce({ value: null });

      const result = await cache.get('non-existing-key');

      expect(result).toBeNull();
      expect(mockMemJSClient.get).toHaveBeenCalledWith('non-existing-key');
    });
  });

  describe('set', () => {
    test('stores the value with the specified TTL', async () => {
      const cache = new MemJSCache({ client: mockMemJSClient });
      const value = { key: 'value' };

      await cache.set('key', value, { ttl: 60 });

      expect(mockMemJSClient.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify(value),
        { expires: 60 }
      );
    });

    test('stores the value with the default TTL when no TTL is specified', async () => {
      const cache = new MemJSCache({ client: mockMemJSClient, defaultTTL: 120 });
      const value = { key: 'value' };

      await cache.set('key', value);

      expect(mockMemJSClient.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify(value),
        { expires: 120 }
      );
    });

    test('stores the value without TTL when no default TTL is set', async () => {
      const cache = new MemJSCache({ client: mockMemJSClient });
      const value = { key: 'value' };

      await cache.set('key', value);

      expect(mockMemJSClient.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify(value),
        { expires: undefined }
      );
    });
  });

  describe('delete', () => {
    test('removes the key from the cache', async () => {
      const cache = new MemJSCache({ client: mockMemJSClient });

      await cache.delete('key');

      expect(mockMemJSClient.delete).toHaveBeenCalledWith('key');
    });
  });
});

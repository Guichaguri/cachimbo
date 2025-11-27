import type { ICache, SetCacheOptions } from '../../types/cache.js';

/**
 * A cache implementation that does nothing.
 * It's useful for disabling cache.
 *
 * @example
 * ```ts
 * const cache = isCacheEnabled ? new LocalTTLCache() : new NoOpCache();
 * ```
 */
export class NoOpCache implements ICache {
  constructor() {}

  async get<T>(key: string): Promise<T | null> {
    return null;
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    return {};
  }

  getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T> {
    return load();
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {}
  async setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {}

  async delete(key: string): Promise<void> {}
  async deleteMany(keys: string[]): Promise<void> {}

}

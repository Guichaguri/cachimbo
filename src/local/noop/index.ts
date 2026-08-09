import type { ICache, LoadContext, SetCacheOptions } from '../../types/cache.js';

/**
 * A cache implementation that stores nothing.
 *
 * Every read misses and every write is discarded, which means {@link ICache#getOrLoad} always calls
 * the `load` function.
 *
 * Use it to disable caching without spreading conditions through your code, such as per environment
 * or in unit tests.
 *
 * @example
 * ```ts
 * const cache = isCacheEnabled ? new LocalTTLCache() : new NoOpCache();
 * ```
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/guides/disabling.md
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/guides/testing.md
 */
export class NoOpCache implements ICache {
  constructor() {}

  async get<T>(key: string): Promise<T | undefined> {
    return undefined;
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T>> {
    return {};
  }

  getOrLoad<T>(key: string, load: (ctx: LoadContext) => Promise<T>, options: SetCacheOptions = {}): Promise<T> {
    return load({ options: { ...options } });
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {}
  async setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {}

  async delete(key: string): Promise<void> {}
  async deleteMany(keys: string[]): Promise<void> {}

}

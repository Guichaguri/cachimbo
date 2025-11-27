import { LRUCache } from 'lru-cache';
import { BaseCache } from '../../base/index.js';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';

export interface ExistingLRUCacheOptions extends BaseCacheOptions {
  /**
   * The existing instance of a LRUCache.
   */
  cache: LRUCache<string, any, () => Promise<any>>;

  /**
   * Whether it should call {@link LRUCache#fetch} when `getOrLoad` is called.
   *
   * For that, {@link LRUCache#fetchMethod} needs to call the context function:
   * ```ts
   * new LRUCache<string, any, () => Promise<any>>({
   *   fetchMethod: (_key, _staleValue, options) => options.context(),
   * });
   * ```
   */
  shouldUseFetch?: boolean;
}

export interface LocalLRUCacheOptions extends BaseCacheOptions {
  /**
   * The default Time to Live (in seconds)
   */
  ttl?: number;

  /**
   * The maximum amount of items stored
   */
  max?: number;
}

/**
 * An in-memory cache implementation of a Least-Recently-Used cache eviction algorithm.
 *
 * It allows setting an expiration time and a limit of cached items.
 *
 * Once the limit of items is reached, the least recently used items will be purged.
 */
export class LocalLRUCache extends BaseCache {
  protected readonly cache: LRUCache<string, any, () => Promise<any>>;
  protected shouldUseFetch?: boolean;

  constructor(options: LocalLRUCacheOptions | ExistingLRUCacheOptions = {}) {
    super(options);

    if ('cache' in options) {
      this.cache = options.cache;
      this.shouldUseFetch = options.shouldUseFetch;
    } else {
      this.cache = new LRUCache<string, any, () => Promise<any>>({
        ttl: options.ttl ? options.ttl * 1000 : undefined,
        max: options.max || 10_000,
        ttlAutopurge: false,
        fetchMethod: (_key, _staleValue, options) => options.context(),
      });
      this.shouldUseFetch = true;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    this.logger?.debug(this.name, '[get]', 'key =', key);

    const data = this.cache.get(key);

    return data === undefined ? null : data;
  }

  override getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T> {
    if (!this.shouldUseFetch) {
      return super.getOrLoad(key, load, options);
    }

    this.logger?.debug(this.name, '[getOrLoad] Running LRUCache\'s fetch...', 'key =', key);

    const ttl = options?.ttl;

    return this.cache.fetch(key, {
      context: load,
      ttl: ttl ? ttl * 1000 : undefined,
    });
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[set]', 'key =', key);

    const ttl = options?.ttl;

    this.cache.set(key, value, {
      ttl: ttl ? ttl * 1000 : undefined,
    });
  }

  async delete(key: string): Promise<void> {
    this.logger?.debug(this.name, '[delete]', 'key =', key);

    this.cache.delete(key);
  }

}

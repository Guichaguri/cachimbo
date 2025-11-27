import { TTLCache } from '@isaacs/ttlcache';
import { BaseCache } from '../../base/index.js';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';

export interface ExistingTTLCacheOptions extends BaseCacheOptions {
  /**
   * Existing instance of a TTLCache
   */
  cache: TTLCache<string, any>;
}

export interface LocalTTLCacheOptions extends BaseCacheOptions {
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
 * An in-memory cache implementation that allows setting an expiration time and a limit of cached items.
 *
 * Once the limit of items is reached, the soonest expiring items will be purged.
 */
export class LocalTTLCache extends BaseCache {
  protected readonly cache: TTLCache<string, any>;

  constructor(options: LocalTTLCacheOptions | ExistingTTLCacheOptions = {}) {
    super(options);

    if ('cache' in options) {
      this.cache = options.cache;
    } else {
      this.cache = new TTLCache<string, any>({
        max: options.max,
        ttl: options.ttl ? options.ttl * 1000 : undefined,
      });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    this.logger?.debug(this.name, '[get]', 'key =', key);

    const data = this.cache.get(key);

    return data === undefined ? null : data as T;
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

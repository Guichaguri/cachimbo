import { TTLCache } from '@isaacs/ttlcache';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';
import { BaseLocalCache } from '../../base/local.js';

export interface ExistingTTLCacheOptions extends BaseCacheOptions {
  /**
   * Existing instance of a TTLCache
   *
   * @remarks This cache cannot emit disposal events. Do not wrap it in a {@link WeakCache}:
   * entries evicted by the LRU stay registered in the `FinalizationRegistry` and may delete
   * a newer entry for the same key once they are garbage collected. Let {@link LocalTTLCache}
   * create the underlying cache instead.
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
 * An in-memory cache store that evicts the items closest to expiring first.
 *
 * Use it when the cached items naturally expire after a fixed duration and access patterns are not a
 * concern. When you want the most accessed items to be kept instead, use {@link LocalLRUCache}.
 *
 * Once the `max` limit of items is reached, the soonest expiring item is purged.
 * By default there is no limit on the amount of items stored.
 *
 * Built on top of the `@isaacs/ttlcache` package.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/stores/in-memory.md
 */
export class LocalTTLCache extends BaseLocalCache {
  protected readonly cache: TTLCache<string, any>;

  constructor(options: LocalTTLCacheOptions | ExistingTTLCacheOptions = {}) {
    super(options);

    if ('cache' in options) {
      this.cache = options.cache;
    } else {
      this.cache = new TTLCache<string, any>({
        max: options.max,
        ttl: options.ttl ? options.ttl * 1000 : undefined,
        dispose: (value, key, reason) => this.onDispose(key, value, reason),
      });
    }
  }

  /** @internal */
  _get<T>(key: string): T | undefined {
    this.logger?.debug(this.name, '[get]', 'key =', key);

    return this.cache.get(key);
  }

  /** @internal */
  _set<T>(key: string, value: T, options?: SetCacheOptions): void {
    this.logger?.debug(this.name, '[set]', 'key =', key);

    const ttl = options?.ttl;

    this.cache.set(key, value, {
      ttl: ttl ? ttl * 1000 : undefined,
    });
  }

  /** @internal */
  _delete(key: string): void {
    this.logger?.debug(this.name, '[delete]', 'key =', key);

    this.cache.delete(key);
  }

}

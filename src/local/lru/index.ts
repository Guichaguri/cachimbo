import { LRUCache } from 'lru-cache';
import type { BaseCacheOptions, LoadContext, SetCacheOptions } from '../../types/cache.js';
import { BaseLocalCache } from '../../base/local.js';

export interface ExistingLRUCacheOptions extends BaseCacheOptions {
  /**
   * The existing instance of a LRUCache.
   *
   * @remarks `LRUCache#disposeAfter` is read-only after construction, so this cache cannot emit
   * disposal events. Do not wrap it in a {@link WeakCache}: entries evicted by the LRU stay
   * registered in the `FinalizationRegistry` and may delete a newer entry for the same key
   * once they are garbage collected. Let {@link LocalLRUCache} create the underlying cache instead.
   */
  cache: LRUCache<string, any, LocalLRUCacheFetcherContext>;

  /**
   * Whether it should call {@link LRUCache#fetch} when `getOrLoad` is called.
   *
   * For that, {@link LRUCache#fetchMethod} needs to call the context function:
   * ```ts
   * new LRUCache<string, any, LocalLRUCacheFetcherContext>({
   *   fetchMethod: LocalLRUCacheFetcher,
   *   max: 100,
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
   *
   * @defaultValue 10000
   */
  max?: number;
}

export type LocalLRUCacheFetcherContext = { load: (ctx: LoadContext) => Promise<any>, options?: SetCacheOptions };

export const LocalLRUCacheFetcher = async (_key: string, _staleValue: any, options: LRUCache.FetcherOptions<string, any, LocalLRUCacheFetcherContext>) => {
  const context: LoadContext = { options: { ...options.context.options } };

  const value = await options.context.load(context);

  options.options.ttl = context.options.ttl ? context.options.ttl * 1000 : undefined;

  return value;
};

/**
 * An in-memory cache store that evicts the least recently used (LRU) items first.
 *
 * Use it when the cached items have different access patterns and you want the most accessed ones
 * to stay cached. When access patterns are not a concern, {@link LocalTTLCache} is simpler and faster.
 *
 * Once the `max` limit of items is reached (10k by default), the least recently used item is purged.
 * Items also expire on their own when a `ttl` is set.
 *
 * Built on top of the `lru-cache` package.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/stores/in-memory.md
 */
export class LocalLRUCache extends BaseLocalCache {
  protected readonly cache: LRUCache<string, any, LocalLRUCacheFetcherContext>;
  protected shouldUseFetch?: boolean;

  constructor(options: LocalLRUCacheOptions | ExistingLRUCacheOptions = {}) {
    super(options);

    if ('cache' in options) {
      this.cache = options.cache;
      this.shouldUseFetch = options.shouldUseFetch;
    } else {
      this.cache = new LRUCache<string, any, LocalLRUCacheFetcherContext>({
        ttl: options.ttl ? options.ttl * 1000 : undefined,
        max: options.max || 10_000,
        ttlAutopurge: false,
        fetchMethod: LocalLRUCacheFetcher,
        disposeAfter: (value, key, reason) => this.onDispose(key, value, reason),
      });
      this.shouldUseFetch = true;
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

  override getOrLoad<T>(key: string, load: (ctx: LoadContext) => Promise<T>, options?: SetCacheOptions): Promise<T> {
    if (!this.shouldUseFetch) {
      return super.getOrLoad(key, load, options);
    }

    this.logger?.debug(this.name, '[getOrLoad] Running LRUCache\'s fetch...', 'key =', key);

    const ttl = options?.ttl;

    return this.cache.fetch(key, {
      context: { load, options },
      ttl: ttl ? ttl * 1000 : undefined,
    });
  }

}

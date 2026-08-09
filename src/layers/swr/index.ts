import type { BaseCacheOptions, ICache, LoadContext, SetCacheOptions } from '../../types/cache.js';
import type { Logger } from '../../types/logger.js';

/**
 * The options to create the {@link SWRCache}
 */
export interface SWRCacheOptions extends BaseCacheOptions {
  /**
   * The underlying cache
   */
  cache: ICache;

  /**
   * The default Time To Live in seconds
   */
  defaultTTL: number;

  /**
   * The additional time in seconds to keep the resource stored, but consider it as stale
   */
  staleTTL: number;
}

interface CachedItem<T> {
  data: T;
  expiresAt: number;
}

/**
 * A cache layer that returns stale resources immediately while it refreshes the cache in background.
 *
 * An entry stays fresh for the TTL given by the caller (or `defaultTTL`) and is then kept for another
 * `staleTTL` seconds. During that stale window, reads return the cached value right away and the first
 * of them triggers a single background refresh, which keeps the read latency low. After the stale
 * window, the entry is gone and the next read has to load from origin in foreground.
 *
 * This is an implementation of the Stale-While-Revalidate algorithm.
 *
 * This strategy is only effective when calling {@link ICache#getOrLoad}.
 * The other methods behave as they would in the underlying cache.
 *
 * @remarks Values are wrapped with freshness metadata, which changes the structure of what is stored.
 * When adding this layer to an existing external cache, version the keys with a
 * {@link KeyTransformingCache} to avoid reading entries written without it.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/layers/stale-while-revalidate.md
 * @see https://web.dev/articles/stale-while-revalidate
 */
export class SWRCache implements ICache {
  protected readonly revalidating: Map<string, Promise<any>> = new Map<string, Promise<any>>();
  protected readonly cache: ICache;
  protected readonly name?: string;
  protected readonly logger?: Logger;
  protected defaultTTL: number;
  protected staleTTL: number;

  constructor(options: SWRCacheOptions) {
    this.cache = options.cache;
    this.name = options.name;
    this.logger = options.logger;
    this.defaultTTL = options.defaultTTL;
    this.staleTTL = options.staleTTL;
  }

  async get<T>(key: string): Promise<T | undefined> {
    this.logger?.debug(this.name, '[get]', 'key =', key);

    const item = await this.cache.get<CachedItem<T>>(key);

    return item ? item.data : undefined;
  }

  async getOrLoad<T>(key: string, load: (ctx: LoadContext) => Promise<T>, options: SetCacheOptions = {}): Promise<T> {
    this.logger?.debug(this.name, '[getOrLoad]', 'key =', key);

    const loadItem = async (ctx: LoadContext): Promise<CachedItem<T>> => {
      const data = await load(ctx);
      const ttl = ctx.options.ttl || this.defaultTTL;

      ctx.options.ttl = ttl + this.staleTTL;

      return {
        data,
        expiresAt: Date.now() + ttl * 1000,
      };
    };

    const item = await this.cache.getOrLoad<CachedItem<T>>(key, loadItem, options);

    // The item is stale, we'll revalidate in background
    if (item && item.expiresAt < Date.now() && !this.revalidating.has(key)) {
      this.logger?.debug(this.name, '[getOrLoad] Refreshing stale resource in background...', 'key =', key);

      const context: LoadContext = { options: { ...options } };

      const promise = loadItem(context)
        .then(newItem => this.cache.set(key, newItem, context.options))
        .finally(() => this.revalidating.delete(key));

      this.revalidating.set(key, promise);

      promise.catch(error =>
        this.logger?.debug(this.name, '[getOrLoad] Failed to refresh in background.', 'key =', key, 'error =', error)
      );
    }

    return item.data;
  }

  set<T>(key: string, value: T, options: SetCacheOptions = {}): Promise<void> {
    this.logger?.debug(this.name, '[set]', 'key =', key);

    const ttl = options.ttl || this.defaultTTL;
    const item: CachedItem<T> = {
      data: value,
      expiresAt: Date.now() + ttl * 1000,
    };
    const cacheOptions = {
      ...options,
      ttl: ttl + this.staleTTL,
    };

    return this.cache.set(key, item, cacheOptions);
  }

  delete(key: string): Promise<void> {
    this.logger?.debug(this.name, '[delete]', 'key =', key);

    return this.cache.delete(key);
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T>> {
    this.logger?.debug(this.name, '[getMany]', 'keys =', keys);

    const data = await this.cache.getMany<CachedItem<T>>(keys);
    const items: Record<string, T> = Object.create(null);

    for (const [key, value] of Object.entries(data)) {
      items[key] = value.data;
    }

    return items;
  }

  setMany<T>(data: Record<string, T>, options: SetCacheOptions = {}): Promise<void> {
    this.logger?.debug(this.name, '[setMany]', 'data =', data);

    const ttl = options.ttl || this.defaultTTL;
    const items: Record<string, CachedItem<T>> = Object.create(null);

    for (const [key, value] of Object.entries(data)) {
      items[key] = {
        data: value,
        expiresAt: Date.now() + ttl * 1000,
      };
    }

    return this.cache.setMany(items, {
      ...options,
      ttl: ttl + this.staleTTL,
    });
  }

  deleteMany(keys: string[]): Promise<void> {
    this.logger?.debug(this.name, '[deleteMany]', 'keys =', keys);

    return this.cache.deleteMany(keys);
  }

}

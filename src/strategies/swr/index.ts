import type { BaseCacheOptions, ICache, SetCacheOptions } from '../../types/cache.js';
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
 * A cache strategy that returns stale resources immediately while it refreshes the cache in background.
 *
 * This is an implementation of the Stale-While-Revalidate algorithm.
 *
 * This strategy is only effective when calling {@link ICache#getOrLoad}.
 */
export class SWRCache implements ICache {
  private readonly revalidating: Map<string, Promise<any>> = new Map<string, Promise<any>>();
  private readonly cache: ICache;
  private readonly name?: string;
  private readonly logger?: Logger;
  private readonly defaultTTL: number;
  private readonly staleTTL: number;

  constructor(options: SWRCacheOptions) {
    this.cache = options.cache;
    this.name = options.name;
    this.logger = options.logger;
    this.defaultTTL = options.defaultTTL;
    this.staleTTL = options.staleTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    this.logger?.debug(this.name, '[get]', 'key =', key);

    const item = await this.cache.get<CachedItem<T>>(key);

    return item === null ? null : item.data;
  }

  async getOrLoad<T>(key: string, load: () => Promise<T>, options: SetCacheOptions = {}): Promise<T> {
    this.logger?.debug(this.name, '[getOrLoad]', 'key =', key);

    const ttl = options.ttl || this.defaultTTL;
    const cacheOptions = {
      ...options,
      ttl: ttl + this.staleTTL,
    };

    const loadItem = async (): Promise<CachedItem<T>> => ({
      data: await load(),
      expiresAt: Date.now() + ttl * 1000,
    });

    const item = await this.cache.getOrLoad<CachedItem<T>>(key, loadItem, cacheOptions);

    // The item is stale, we'll revalidate in background
    if (item && item.expiresAt < Date.now() && !this.revalidating.has(key)) {
      this.logger?.debug(this.name, '[getOrLoad] Refreshing stale resource in background...', 'key =', key);

      const promise = loadItem()
        .then(newItem => this.cache.set(key, newItem, cacheOptions))
        .finally(() => this.revalidating.delete(key));

      this.revalidating.set(key, promise);
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

  async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    this.logger?.debug(this.name, '[getMany]', 'keys =', keys);

    const data = await this.cache.getMany<CachedItem<T>>(keys);
    const items: Record<string, T | null> = {};

    for (const [key, value] of Object.entries(data)) {
      items[key] = value ? value.data : null;
    }

    return items;
  }

  setMany<T>(data: Record<string, T>, options: SetCacheOptions = {}): Promise<void> {
    this.logger?.debug(this.name, '[setMany]', 'data =', data);

    const ttl = options.ttl || this.defaultTTL;
    const items: Record<string, CachedItem<T>> = {};

    for (const [key, value] of Object.entries(data)) {
      items[key] = {
        data: value,
        expiresAt: Date.now() + ttl * 1000,
      };
    }

    return this.cache.setMany(data, {
      ...options,
      ttl: ttl + this.staleTTL,
    });
  }

  deleteMany(keys: string[]): Promise<void> {
    this.logger?.debug(this.name, '[deleteMany]', 'keys =', keys);

    return this.cache.deleteMany(keys);
  }

}

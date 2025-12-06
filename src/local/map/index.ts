import { BaseCache } from '../../base/index.js';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';

export interface LocalMapCacheOptions extends BaseCacheOptions {
  /**
   * The underlying map.
   */
  cache?: MapLike<string, any>;

  /**
   * The maximum size of the cache.
   * When not set, the cache can grow indefinitely.
   */
  max?: number;
}

export interface MapLike<K, V> {
  get(key: K): V;
  set(key: K, value: V): void;
  delete(key: K): void;
  has(key: K): boolean;
  keys(): IterableIterator<K>;
  size: number;
  clear(): void;
}

/**
 * A simple in-memory cache implementation based on {@link Map}.
 *
 * It ignores expiration times, but a limit of cached items can be set.
 *
 * Once the limit of items is reached, the first inserted keys will be purged.
 */
export class LocalMapCache extends BaseCache {
  protected readonly cache: MapLike<string, any>;
  protected max: number;

  constructor(options: LocalMapCacheOptions = {}) {
    super(options);
    this.cache = options.cache ?? new Map<string, any>();
    this.max = options.max ?? Infinity;
  }

  async get<T>(key: string): Promise<T | null> {
    this.logger?.debug(this.name, '[get]', 'key =', key);

    const data = this.cache.get(key);

    return data === undefined ? null : data;
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[set]', 'key =', key);

    if (this.cache.size >= this.max && !this.cache.has(key)) {
      this.evict(1);
    }

    this.cache.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.logger?.debug(this.name, '[delete]', 'key =', key);

    this.cache.delete(key);
  }

  override async setMany(data: Record<string, any>, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[setMany]', 'data =', data);

    const entries = Object.entries(data);

    const newEntries = entries.filter(([key]) => !this.cache.has(key)).length;

    if (this.cache.size + newEntries > this.max) {
      this.evict(this.cache.size + newEntries - this.max);
    }

    for (const [key, value] of entries) {
      this.cache.set(key, value);
    }
  }

  clear(): void {
    this.logger?.debug(this.name, '[clear]');

    this.cache.clear();
  }

  protected evict(length: number): void {
    const keys = this.cache.keys();

    for (let i = 0; i < length; i++) {
      const key = keys.next();

      if (key.done) {
        break;
      }

      this.logger?.debug(this.name, '[evict]', 'key = ', key);

      this.cache.delete(key.value);
    }
  }

}

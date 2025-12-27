import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';
import { BaseLocalCache } from '../../base/local.js';

export interface LocalMapCacheOptions extends BaseCacheOptions {
  /**
   * The underlying map.
   */
  map?: MapLike<string, any>;

  /**
   * The maximum size of the cache.
   * When not set, the cache can grow indefinitely.
   */
  max?: number;
}

export interface MapLike<K, V> {
  get(key: K): V | undefined;
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
 * It implements a simple FIFO eviction policy:
 * Once the limit of items is reached, the first inserted keys will be purged.
 */
export class LocalMapCache extends BaseLocalCache {
  protected readonly map: MapLike<string, any>;
  protected max: number;

  constructor(options: LocalMapCacheOptions = {}) {
    super(options);
    this.map = options.map ?? new Map<string, any>();
    this.max = options.max ?? Infinity;
  }

  /** @internal */
  _get<T>(key: string): T | null {
    this.logger?.debug(this.name, '[get]', 'key =', key);

    const data = this.map.get(key);

    return data === undefined ? null : data;
  }

  /** @internal */
  _set<T>(key: string, value: T, options?: SetCacheOptions): void {
    this.logger?.debug(this.name, '[set]', 'key =', key);

    const previousValue = this.map.get(key);

    if (this.map.size >= this.max && previousValue === undefined) {
      this.evict(1);
    }

    this.map.set(key, value);
    this.onDispose(key, previousValue, 'set');
  }

  /** @internal */
  _delete(key: string): void {
    this.logger?.debug(this.name, '[delete]', 'key =', key);

    const previousValue = this.map.get(key);
    this.map.delete(key);
    this.onDispose(key, previousValue, 'delete');
  }

  override async setMany(data: Record<string, any>, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[setMany]', 'data =', data);

    const entries = Object.entries(data);

    const newEntries = entries.filter(([key]) => !this.map.has(key)).length;

    if (this.map.size + newEntries > this.max) {
      this.evict(this.map.size + newEntries - this.max);
    }

    for (const [key, value] of entries) {
      const previousValue = this.map.get(key);
      this.map.set(key, value);
      this.onDispose(key, previousValue, 'set');
    }
  }

  clear(): void {
    this.logger?.debug(this.name, '[clear]');

    for (const key of this.map.keys()) {
      this.onDispose(key, this.map.get(key), 'delete');
    }

    this.map.clear();
  }

  protected override onDispose(key: string, value: any, reason?: string) {
    if (value !== undefined) {
      super.onDispose(key, value, reason);
    }
  }

  protected evict(length: number): void {
    const keys = this.map.keys();

    for (let i = 0; i < length; i++) {
      const key = keys.next();

      if (key.done) {
        break;
      }

      this.logger?.debug(this.name, '[evict]', 'key = ', key);

      const previousValue = this.map.get(key.value);
      this.map.delete(key.value);
      this.onDispose(key.value, previousValue, 'evict');
    }
  }

}

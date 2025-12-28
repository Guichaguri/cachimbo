import { BaseLocalCache, type LocalCacheInternal } from '../../base/local.js';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';

export interface DeepCloningCacheOptions extends BaseCacheOptions {
  /**
   * The underlying cache. This must be an in-memory cache.
   */
  cache: BaseLocalCache;

  /**
   * The deep clone function to use.
   *
   * By default, it will try to use `structuredClone()` if available,
   * otherwise it will use a JSON.parse/stringify-based implementation.
   *
   * @param data The data to deep clone
   * @returns The cloned data
   */
  deepClone?: <T>(data: T) => T;
}

/**
 * A cache layer that deep clones data when reading and writing.
 *
 * This is useful when you mutate the objects retrieved from cache,
 * and you don't want them to also change in cache.
 *
 * Do not use this layer if you do not intend to mutate cached objects,
 * as the cloning process adds unnecessary overhead.
 */
export class DeepCloningCache extends BaseLocalCache {
  protected readonly cache: BaseLocalCache;
  protected readonly cacheInternal: LocalCacheInternal;
  protected deepClone: <T>(data: T) => T;

  constructor(options: DeepCloningCacheOptions) {
    super(options);

    this.cache = options.cache;
    this.cacheInternal = options.cache.internal;

    if (options.deepClone) {
      this.deepClone = options.deepClone;
    } else if (typeof structuredClone === 'function') {
      // Use structuredClone whenever available since it is faster than JSON
      this.deepClone = structuredClone;
    } else {
      // Since we already expect cached items to be JSON-serializable,
      // we can use this simple implementation (that is also pretty fast).
      this.deepClone = <T>(data: T): T => JSON.parse(JSON.stringify(data));
    }
  }

  protected _get<T>(key: string): T | null {
    return this.deepClone(this.cacheInternal._get(key));
  }

  protected _set<T>(key: string, value: T, options?: SetCacheOptions): void {
    this.cacheInternal._set(key, this.deepClone(value), options);
  }

  protected _delete(key: string): void {
    this.cacheInternal._delete(key);
  }

  protected override _getMany<T>(keys: string[]): Record<string, T | null> {
    return this.deepClone(this.cacheInternal._getMany<T>(keys));
  }

  protected override _setMany<T>(data: Record<string, T>, options?: SetCacheOptions): void {
    this.cacheInternal._setMany(this.deepClone(data), options);
  }

  protected override _deleteMany(keys: string[]): void {
    this.cacheInternal._deleteMany(keys);
  }

  protected override _addDisposeListener(listener: any): void {
    this.cacheInternal._addDisposeListener(listener);
  }

  override async getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T> {
    const loadWrapped = async () => this.deepClone(await load());

    return this.deepClone(await this.cache.getOrLoad(key, loadWrapped, options));
  }
}

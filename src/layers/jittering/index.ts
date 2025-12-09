import type { ICache, SetCacheOptions } from '../../types/cache.js';

export interface JitteringCacheOptions {
  /**
   * The underlying cache
   */
  cache: ICache;

  /**
   * The default Time To Live in seconds
   */
  defaultTTL: number;

  /**
   * The maximum jitter (in seconds) to add to the TTL of cached items.
   */
  maxJitterTTL: number;
}

/**
 * A cache layer that adds a random jitter to the TTL of cached items to prevent cache stampedes.
 *
 * This layer is useful in scenarios where many cached items expire simultaneously, causing a sudden surge of requests to the underlying data source.
 */
export class JitteringCache implements ICache {
  protected readonly cache: ICache;
  protected defaultTTL: number;
  protected maxJitterTTL: number;

  constructor(options: JitteringCacheOptions) {
    this.cache = options.cache;
    this.defaultTTL = options.defaultTTL;
    this.maxJitterTTL = options.maxJitterTTL;
  }

  get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  getOrLoad<T>(key: string, load: () => Promise<T>, options: SetCacheOptions = {}): Promise<T> {
    return this.cache.getOrLoad<T>(key, load, this.jitterTTL(options));
  }

  set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    return this.cache.set<T>(key, value, this.jitterTTL(options));
  }

  delete(key: string): Promise<void> {
    return this.cache.delete(key);
  }

  getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    return this.cache.getMany(keys);
  }

  setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    return this.cache.setMany(data, this.jitterTTL(options));
  }

  deleteMany(keys: string[]): Promise<void> {
    return this.cache.deleteMany(keys);
  }

  protected jitterTTL(options: SetCacheOptions = {}): SetCacheOptions {
    const ttl = options.ttl ?? this.defaultTTL;
    const jitter = Math.random() * this.maxJitterTTL;

    return {
      ...options,
      ttl: ttl + jitter,
    };
  }
}

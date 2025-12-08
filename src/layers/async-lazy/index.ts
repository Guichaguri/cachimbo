import type { ICache, SetCacheOptions } from '../../types/cache.js';

export interface AsyncLazyCacheOptions {
  /**
   * A factory function that will be called to create the underlying cache when needed.
   */
  factory: () => Promise<ICache> | ICache;

  /**
   * Whether it should initialize only when needed.
   *
   * - When set to `true`, it will initialize the cache only when a method is called.
   * - When set to `false`, it will initialize the cache upon construction.
   *
   * @default `false`
   */
  lazy?: boolean;
}

/**
 * A cache layer that initializes the underlying cache asynchronously.
 *
 * This layer can be used to connect to an external cache with the cache methods already available.
 *
 * This layer can also be used to lazily initialize the cache only when it's actually needed.
 *
 * @example
 * ```ts
 * const cache = new AsyncCache({
 *   factory: async () => {
 *     const redisClient = await createClient({
 *       url: "redis://user:password@localhost:6380",
 *     });
 *
 *     return new RedisCache({ client: redisClient });
 *   },
 *   lazy: true,
 * });
 *
 * cache.get("key")
 *   .then(result => console.log('redis was connected and read the key:', value));
 * ```
 */
export class AsyncLazyCache implements ICache {
  protected readonly factory: () => Promise<ICache> | ICache;
  protected cache: Promise<ICache> | null = null;

  constructor(options: AsyncLazyCacheOptions) {
    this.factory = options.factory;

    if (!options.lazy) {
      this.cache = Promise.resolve(this.factory());
    }
  }

  async get<T>(key: string): Promise<T | null> {
    return (await this.resolveCache()).get<T>(key);
  }

  async getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T> {
    return (await this.resolveCache()).getOrLoad<T>(key, load, options);
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    return (await this.resolveCache()).set<T>(key, value, options);
  }

  async delete(key: string): Promise<void> {
    return (await this.resolveCache()).delete(key);
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    return (await this.resolveCache()).getMany<T>(keys);
  }

  async setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    return (await this.resolveCache()).setMany<T>(data, options);
  }

  async deleteMany(keys: string[]): Promise<void> {
    return (await this.resolveCache()).deleteMany(keys);
  }

  /**
   * Gets the underlying cache, initializing it if not already initialized.
   */
  public resolveCache(): Promise<ICache> {
    if (!this.cache) {
      this.cache = Promise.resolve(this.factory());
    }

    return this.cache;
  }

}

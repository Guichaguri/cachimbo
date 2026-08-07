import type { BaseCacheOptions, ICache, LoadContext, SetCacheOptions } from '../../types/cache.js';
import type { Logger } from '../../types/logger.js';

export interface AsyncLazyCacheOptions extends BaseCacheOptions {
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

  /**
   * The amount of times it should try to initialize again when the factory throws an except
   *
   * - When set to `0`, it will try to initialize it once. If it fails, any cache call will throw an error.
   * - When set to a positive number, any cache call will try to initialize it again, until the count returns to zero.
   * - When set to `Infinity`, it will keep on trying to initialize.
   *
   * @default `0`
   */
  retryCount?: number;
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
 * const cache = new AsyncLazyCache({
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
  protected readonly name?: string;
  protected readonly logger?: Logger;
  protected retryCount: number;
  protected cache: Promise<ICache> | null = null;

  constructor(options: AsyncLazyCacheOptions) {
    this.factory = options.factory;
    this.name = options.name;
    this.logger = options.logger;
    this.retryCount = options.retryCount ?? 0;

    if (!options.lazy) {
      // Nothing is awaiting the initialization yet, so the failure is only logged here.
      // The next call retries the factory and propagates the error to the caller.
      this.resolveCache().catch(error =>
        this.logger?.debug(this.name, '[constructor] Failed to initialize the cache.', 'error =', error)
      );
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    return (await this.resolveCache()).get<T>(key);
  }

  async getOrLoad<T>(key: string, load: (ctx: LoadContext) => Promise<T>, options?: SetCacheOptions): Promise<T> {
    return (await this.resolveCache()).getOrLoad<T>(key, load, options);
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    return (await this.resolveCache()).set<T>(key, value, options);
  }

  async delete(key: string): Promise<void> {
    return (await this.resolveCache()).delete(key);
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T>> {
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
      this.cache = Promise.resolve(this.factory()).catch(error => {
        this.logger?.debug(this.name, '[resolveCache] Failed to initialize the cache.', 'error =', error);

        // When the factory fails, the result is discarded so the next call initializes it again.
        // Otherwise a single transient failure (such as a connection refused on startup)
        // would keep the cache broken for the entire lifetime of the process.
        if (this.retryCount > 0) {
          this.cache = null;
          this.retryCount--;
        }

        throw error;
      });
    }

    return this.cache;
  }

}

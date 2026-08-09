import type { BaseCacheOptions, ICache, LoadContext, SetCacheOptions } from '../types/cache.js';
import type { Logger } from '../types/logger.js';

/**
 * The base implementation of a cache.
 *
 * This class only requires subclasses to implement {@link ICache#get}, {@link ICache#set} and {@link ICache#delete}.
 * All other methods fall back into these three, running the batch operations in parallel.
 *
 * External cache stores should extend this class, overriding the batch methods whenever the client
 * supports a real batch command. In-memory stores should extend {@link BaseLocalCache} instead.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/guides/extending.md
 */
export abstract class BaseCache implements ICache {
  protected readonly name?: string;
  protected readonly logger?: Logger;

  protected constructor(options: BaseCacheOptions) {
    this.name = options.name;
    this.logger = options.logger;
  }

  abstract get<T>(key: string): Promise<T | undefined>;

  abstract set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void>;

  abstract delete(key: string): Promise<void>;

  async getOrLoad<T>(key: string, load: (ctx: LoadContext) => Promise<T>, options?: SetCacheOptions): Promise<T> {
    let data = await this.get<T>(key);

    if (data !== undefined) {
      this.logger?.debug(this.name, '[getOrLoad] Returning from cache.', 'key =', key);

      return data;
    }

    this.logger?.debug(this.name, '[getOrLoad] Refreshing the cache...', 'key =', key);

    const context: LoadContext = { options: options ? { ...options } : {} };

    data = await load(context);

    if (data !== undefined) {
      await this.set(key, data, context.options);
    }

    return data;
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T>> {
    this.logger?.debug(this.name, '[getMany] Reading all keys in parallel...', 'keys =', keys);

    const entries = await Promise.all(
      keys.map(async key => [key, await this.get<any>(key)] as const),
    );

    return Object.fromEntries(
      entries.filter(([, value]) => value !== undefined),
    );
  }

  async setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[setMany] Writing all keys in parallel...', 'data =', data);

    await Promise.all(
      Object.entries(data).map(([key, value]) =>
        this.set(key, value, options)
      ),
    );
  }

  async deleteMany(keys: string[]): Promise<void> {
    this.logger?.debug(this.name, '[deleteMany] Deleting all keys in parallel...', 'keys =', keys);

    await Promise.all(
      keys.map(key => this.delete(key)),
    );
  }

}

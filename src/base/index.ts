import type { BaseCacheOptions, ICache, SetCacheOptions } from '../types/cache.js';
import type { Logger } from '../types/logger.js';

/**
 * The base implementation of a cache.
 *
 * This class only requires subclasses to implement {@link ICache#get}, {@link ICache#set} and {@link ICache#delete}.
 * All other methods fall back into these three.
 */
export abstract class BaseCache implements ICache {
  protected readonly name?: string;
  protected readonly logger?: Logger;

  protected constructor(options: BaseCacheOptions) {
    this.name = options.name;
    this.logger = options.logger;
  }

  abstract get<T>(key: string): Promise<T | null>;

  abstract set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void>;

  abstract delete(key: string): Promise<void>;

  async getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T> {
    let data = await this.get<T>(key);

    if (data !== null) {
      this.logger?.debug(this.name, '[getOrLoad] Returning from cache.', 'key =', key);

      return data;
    }

    this.logger?.debug(this.name, '[getOrLoad] Refreshing the cache...', 'key =', key);

    data = await load();

    await this.set(key, data, options);

    return data;
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    this.logger?.debug(this.name, '[getMany] Reading all keys in parallel...', 'keys =', keys);

    return Object.fromEntries(
      await Promise.all(
        keys.map(async key => [key, await this.get<any>(key)]),
      ),
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

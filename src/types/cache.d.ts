import type { Logger } from './logger.js';

export interface SetCacheOptions {
  /**
   * Time to Live in seconds
   */
  ttl?: number;
}

export interface BaseCacheOptions {
  /**
   * The name of this strategy. Used for logging
   */
  name?: string;

  /**
   * A logger that is useful for debugging the cache chain
   */
  logger?: Logger;
}

export interface ICache {

  /**
   * Reads the cached resource from a key.
   * Returns `null` when the resource is not found.
   *
   * @param key The cache key
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Reads the cached resource from a key.
   * If the cached resource is not found, fetches it by calling the `load` function and then saves it into cache.
   *
   * @param key The cache key
   * @param load The function which should fetch the fresh data from origin
   * @param options The options used to save the cache
   */
  getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T>;

  /**
   * Writes a resource into cache.
   *
   * The value **must** be JSON stringifiable.
   *
   * @param key The cache key
   * @param value The resource value
   * @param options The options to save the cache
   */
  set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void>;

  /**
   * Deletes a cached resource by a key.
   *
   * @param key The cache key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Reads cached resources in batch.
   *
   * @param keys The list of cache keys.
   */
  getMany<T>(keys: string[]): Promise<Record<string, T | null>>;

  /**
   * Writes cache resources in batch.
   *
   * The values **must** be JSON stringifiable.
   *
   * @param data The cache keys and values
   * @param options The options to save the cache
   */
  setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void>;

  /**
   * Deletes cached resources by their keys in batch.
   *
   * @param keys The list of keys to delete
   */
  deleteMany(keys: string[]): Promise<void>;

}

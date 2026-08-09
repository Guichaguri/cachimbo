import type { RuntimeCache } from '@vercel/functions';
import { BaseCache } from '../../base/index.js';
import type { BaseCacheOptions, LoadContext, SetCacheOptions } from '../../types/cache.js';

export interface VercelRuntimeCacheOptions extends BaseCacheOptions {
  /**
   * The Vercel Runtime Cache instance
   *
   * @example
   * ```ts
   * import { getCache } from '@vercel/functions';
   *
   * const cache = new VercelRuntimeCache({ cache: getCache() });
   * ```
   */
  cache: RuntimeCache;
}

export interface SetVercelRuntimeCacheOptions extends SetCacheOptions {
  /**
   * The list of tags to associate with the cached item.
   *
   * These are Vercel's own tags, which {@link VercelRuntimeCache#invalidateTag} invalidates server-side.
   * They are unrelated to the tags handled by the {@link TaggedCache} layer.
   */
  tags?: string[];

  /**
   * A user-friendly name for the cached item, only used by Vercel's observability.
   *
   * Defaults to the cache key, which is the readable one rather than the hashed one that is
   * actually stored. Pass an empty string to omit it.
   */
  name?: string;
}

/**
 * A cache store that wraps the Vercel's Runtime Cache.
 *
 * It can be used as the backing store for Vercel's Functions, Routing Middlewares and Builds.
 *
 * The instance has to be created by your application through `getCache()`, this class only issues operations.
 * Values are stored JSON-serialized, so they **must** be JSON stringifiable.
 *
 * The Runtime Cache has no batch commands, so every batch operation runs key by key, in parallel.
 *
 * `getCache()` already hashes the keys and can namespace them, which usually makes a
 * {@link KeyTransformingCache} unnecessary in front of this store. A missing item reads as `undefined`,
 * so a cached `null` is indistinguishable from a miss.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/stores/vercel-runtime-cache.md
 * @see https://vercel.com/docs/caching/runtime-cache
 */
export class VercelRuntimeCache extends BaseCache {
  protected readonly cache: RuntimeCache;

  constructor(options: VercelRuntimeCacheOptions) {
    super(options);
    this.cache = options.cache;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const result = await this.cache.get(key);

    return result === null ? undefined : result as T;
  }

  async set<T>(key: string, value: T, options?: SetVercelRuntimeCacheOptions): Promise<void> {
    await this.cache.set(key, value, options);
  }

  async delete(key: string): Promise<void> {
    await this.cache.delete(key);
  }

  /**
   * Expires all items carrying a tag, through Vercel's own tag invalidation.
   *
   * Only the tags written through the `tags` option of {@link VercelRuntimeCache#set} are considered.
   * The {@link TaggedCache} layer keeps its own tag bookkeeping and does not call this method,
   * so the two mechanisms invalidate independently from each other.
   *
   * @param tag The tag name
   */
  async invalidateTag(tag: string): Promise<void> {
    await this.cache.expireTag(tag);
  }

  /**
   * Expires all items carrying a tag, through Vercel's own tag invalidation.
   *
   * Only the tags written through the `tags` option of {@link VercelRuntimeCache#set} are considered.
   * The {@link TaggedCache} layer keeps its own tag bookkeeping and does not call this method,
   * so the two mechanisms invalidate independently from each other.
   *
   * @param tags A list of tag names
   */
  async invalidateTags(tags: string[]): Promise<void> {
    await this.cache.expireTag(tags);
  }
}

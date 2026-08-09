import type Memcache from 'memcache';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';
import { BaseCache } from '../../base/index.js';

export interface MemcacheCacheOptions extends BaseCacheOptions {
  /**
   * The Memcache client
   */
  client: Memcache;

  /**
   * The default Time To Live in seconds
   */
  defaultTTL?: number;
}

/**
 * A Memcached cache store using the `memcache` client.
 *
 * The client has to be created by your application, this class only issues commands.
 * Values are stored JSON-serialized, so they **must** be JSON stringifiable.
 *
 * @remarks Memcached keys are limited to 250 characters and cannot contain spaces or control characters.
 * TTLs greater than 30 days (2592000 seconds) are read as absolute unix timestamps by the server,
 * so keep them below that. A {@link KeyTransformingCache} can hash or normalize keys that may not fit.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/stores/memcached.md
 */
export class MemcacheCache extends BaseCache {
  protected readonly client: Memcache;
  protected defaultTTL?: number;

  constructor(options: MemcacheCacheOptions) {
    super(options);
    this.client = options.client;
    this.defaultTTL = options.defaultTTL;
  }

  async get<T>(key: string): Promise<T | undefined> {
    this.logger?.debug(this.name, '[get] Running "get" command...', 'key =', key);

    const raw = await this.client.get(key);

    return raw ? JSON.parse(raw) : undefined;
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[set] Running "set" command...', 'key =', key);

    await this.client.set(
      key,
      JSON.stringify(value),
      options?.ttl ?? this.defaultTTL,
    );
  }

  async delete(key: string): Promise<void> {
    this.logger?.debug(this.name, '[delete] Running "delete" command...', 'key =', key);

    await this.client.delete(key);
  }

  override async getMany<T>(keys: string[]): Promise<Record<string, T>> {
    this.logger?.debug(this.name, '[getMany] Running "get" command...', 'keys =', keys);

    const raw = await this.client.gets(keys);
    const data: Record<string, T> = Object.create(null);

    raw.forEach((value, key) => {
      if (value) {
        data[key] = JSON.parse(value);
      }
    });

    return data;
  }
}

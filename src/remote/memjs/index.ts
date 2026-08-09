import type { Client } from 'memjs';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';
import { BaseCache } from '../../base/index.js';

export interface MemJSCacheOptions extends BaseCacheOptions {
  /**
   * The memjs client
   */
  client: Client;

  /**
   * The default Time To Live in seconds
   */
  defaultTTL?: number;
}

/**
 * A Memcached cache store using the MemJS client.
 *
 * The client has to be created by your application, this class only issues commands.
 * Values are stored JSON-serialized, so they **must** be JSON stringifiable.
 *
 * MemJS has no batch commands, so every batch operation runs key by key.
 * Prefer {@link MemcacheCache} unless you are already using MemJS.
 *
 * Memcached keys are limited to 250 characters and cannot contain spaces or control characters.
 * TTLs greater than 30 days (2592000 seconds) are read as absolute unix timestamps by the server,
 * so keep them below that. A {@link KeyTransformingCache} can hash or normalize keys that may not fit.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/stores/memcached.md
 */
export class MemJSCache extends BaseCache {
  protected readonly client: Client;
  protected defaultTTL?: number;

  constructor(options: MemJSCacheOptions) {
    super(options);
    this.client = options.client;
    this.defaultTTL = options.defaultTTL;
  }

  async get<T>(key: string): Promise<T | undefined> {
    this.logger?.debug(this.name, '[get] Running "get" command...', 'key =', key);

    const { value } = await this.client.get(key);

    return value ? JSON.parse(value.toString('utf8')) : undefined;
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[set] Running "set" command...', 'key =', key);

    await this.client.set(
      key,
      JSON.stringify(value),
      {
        expires: options?.ttl ?? this.defaultTTL,
      },
    );
  }

  async delete(key: string): Promise<void> {
    this.logger?.debug(this.name, '[delete] Running "delete" command...', 'key =', key);

    await this.client.delete(key);
  }

}

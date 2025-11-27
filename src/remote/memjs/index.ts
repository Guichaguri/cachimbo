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
 * A Memcached cache implementation using MemJS
 */
export class MemJSCache extends BaseCache {
  protected readonly client: Client;
  protected defaultTTL?: number;

  constructor(options: MemJSCacheOptions) {
    super(options);
    this.client = options.client;
    this.defaultTTL = options.defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    this.logger?.debug(this.name, '[get] Running "get" command...', 'key =', key);

    const { value } = await this.client.get(key);

    return value ? JSON.parse(value.toString('utf8')) : null;
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

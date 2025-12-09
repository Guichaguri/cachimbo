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
 * A Memcached cache implementation using Memcache
 */
export class MemcacheCache extends BaseCache {
  protected readonly client: Memcache;
  protected defaultTTL?: number;

  constructor(options: MemcacheCacheOptions) {
    super(options);
    this.client = options.client;
    this.defaultTTL = options.defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    this.logger?.debug(this.name, '[get] Running "get" command...', 'key =', key);

    const raw = await this.client.get(key);

    return raw ? JSON.parse(raw) : null;
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

  override async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    this.logger?.debug(this.name, '[getMany] Running "get" command...', 'keys =', keys);

    const raw = await this.client.gets(keys);
    const data: Record<string, T | null> = {};

    raw.forEach((value, key) => {
      data[key] = value ? JSON.parse(value) : null;
    });

    return data;
  }
}

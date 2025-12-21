import { BaseCache } from '../../base/index.js';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';
import type { BaseClient, GlideClient, GlideClusterClient } from '@valkey/valkey-glide';

export interface ValkeyGlideCacheOptions extends BaseCacheOptions {
  /**
   * The GLIDE client instance
   */
  client: GlideClient | GlideClusterClient | BaseClient;

  /**
   * The default Time To Live in seconds
   */
  defaultTTL?: number;
}

/**
 * A Valkey cache implementation using @valkey/valkey-glide
 */
export class ValkeyGlideCache extends BaseCache {
  protected readonly client: BaseClient;
  protected defaultTTL?: number;

  constructor(options: ValkeyGlideCacheOptions) {
    super(options);
    this.client = options.client;
    this.defaultTTL = options.defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    this.logger?.debug(this.name, '[get] Running "GET" command...', 'key =', key);

    const raw = await this.client.get(key);

    return raw ? JSON.parse(raw.toString()) : null;
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[set] Running "SET" command...', 'key =', key);

    const ttl = options?.ttl ?? this.defaultTTL;

    await this.client.set(
      key,
      JSON.stringify(value),
      { expiry: ttl ? { type: 'EX' as any, count: ttl } : undefined },
    );
  }

  async delete(key: string): Promise<void> {
    this.logger?.debug(this.name, '[delete] Running "UNLINK" command...', 'key =', key);

    await this.client.unlink([key]);
  }

  override async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    this.logger?.debug(this.name, '[getMany] Running "MGET" command...', 'keys =', keys);

    const values = await this.client.mget(keys);

    const data: Record<string, T | null> = {};

    for (let i = 0; i < keys.length; i++) {
      const value = values[i];

      data[keys[i]!] = value ? JSON.parse(value.toString()) : null;
    }

    return data;
  }

  override async deleteMany(keys: string[]): Promise<void> {
    this.logger?.debug(this.name, '[deleteMany] Running "UNLINK" command...', 'keys =', keys);

    await this.client.unlink(keys);
  }

}
